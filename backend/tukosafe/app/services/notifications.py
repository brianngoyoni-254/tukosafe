"""Push (FCM) + SMS (Africa\'s Talking) delivery with graceful log-mode fallback.

Design (per Project Documentation v1.0):
- Critical alerts go push-first with SMS fallback.
- Every delivery attempt is recorded in ``alert_deliveries`` (audit).
- Message tone is calm + verification-first. Never announces harm.
- Bilingual templates: English + Swahili (Sheng-friendly tone).
"""
from __future__ import annotations

import datetime as dt
import logging

from sqlalchemy import desc, select

from ..config import get_settings
from ..database import db
from ..models import (
    AlertDelivery, Device, LocationPoint, LocationShare, User, utcnow,
)

logger = logging.getLogger("tukosafe.notifications")
settings = get_settings()

EMERGENCY_LINE = "In an emergency, call 999 or 112."
HATUA_DHARURA = "Dharura? Piga 999 au 112."

# ---------------- Message templates (tone = calm, verification-first) ----------------
T = {
    "checkin_reminder": {
        "en": "Hi {name}, are you home safe? Please confirm so your friends know you\'re okay.",
        "sw": "Hi {name}, umefika salama? Tafadhali thibitisha ili marafiki wajue uko sawa.",
    },
    "contact_missed_checkin": {
        "en": (
            "{name} hasn\'t confirmed arrival yet. This may be a dead battery or poor signal. "
            "Please try calling them. Last known location: {last_seen}."
        ),
        "sw": (
            "{name} hajathibitisha kufika bado. Huenda simu iliisha chaji au mtandao ni mbaya. "
            "Tafadhali mpigie. Eneo la mwisho: {last_seen}."
        ),
    },
    "discreet_help": {
        "en": "Your friend {name} has asked you to call or come and help. Tap to see where they are.",
        "sw": "Rafiki yako {name} ameomba umpigie au umsaidie. Gusa kuona alipo.",
    },
    "sos": {
        "en": (
            "{name} has requested urgent help. Last location shared at {last_seen}. "
            "Call them now. If you believe they are in danger, call 999 or 112."
        ),
        "sw": (
            "{name} ameomba msaada wa haraka. Eneo la mwisho {last_seen}. "
            "Mpigie sasa. Ukiamini yuko hatarini, piga 999 au 112."
        ),
    },
    "arrived": {
        "en": "{name} has arrived safely. No further action needed.",
        "sw": "{name} amefika salama. Hakuna hatua zaidi.",
    },
    "journey_overdue": {
        "en": (
            "{name}\'s journey is past its expected arrival time. This may be traffic or a delay � "
            "please try calling them to verify they\'re okay."
        ),
        "sw": (
            "Safari ya {name} imechelewa kuliko ilivyotarajiwa. Huenda ni trafiki � "
            "tafadhalimpigie kuthibitisha yuko sawa."
        ),
    },
    "outing_invite": {
        "en": "{name} invited you to \'{outing}\'. Open TukoSafe to join with code {code}.",
        "sw": "{name} amekualika \'{outing}\'. Fungua TukoSafe ujiunge na kodi {code}.",
    },
}


def msg(key: str, locale: str = "en", **kw) -> str:
    loc = locale if locale in ("en", "sw") else "en"
    return T[key][loc].format(**kw)


def fmt_time(value: dt.datetime | None) -> str:
    if value is None:
        return "unknown time"
    v = value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)
    return v.strftime("%H:%M %d %b")


def _try_init_fcm():
    if not settings.FIREBASE_CREDENTIALS_PATH:
        return None
    try:
        import firebase_admin
        from firebase_admin import credentials
        if not firebase_admin._apps:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("FCM unavailable: %s", exc)
        return None


def _try_init_sms():
    if not (settings.AT_USERNAME and settings.AT_API_KEY):
        return None
    try:
        import africastalking  # noqa: F401
        return True
    except Exception:
        return None


def send_push(db, user_id, title, body, data=None, source_type="general", source_id=0):
    """Push to app user\'s devices; log-mode fallback. Returns alert_deliveries id."""
    from ..models import AlertDelivery as AD

    devices = db.session.execute(
        select(Device).where(Device.user_id == user_id)
    ).scalars().all()
    sent_ok = False
    if devices and _try_init_fcm():
        try:
            from firebase_admin import messaging
            resp = messaging.send_each_for_multicast(
                messaging.MulticastMessage(
                    tokens=[d.fcm_token for d in devices],
                    notification=messaging.Notification(title=title, body=body),
                    data={k: str(v) for k, v in (data or {}).items()},
                )
            )
            sent_ok = resp.success_count > 0
        except Exception as exc:  # pragma: no cover
            logger.warning("FCM send failed: %s", exc)
    if not devices or not sent_ok:
        logger.info("[PUSH log-mode] to user=%s title=%s body=%s", user_id, title, body)
    row = AD(
        source_type=source_type, source_id=source_id, recipient_id=user_id,
        channel="push", status="sent", message=f"{title} � {body}",
    )
    db.session.add(row)
    db.session.flush()
    return row.id


def send_sms(db, phone, message, source_type="general", source_id=0, recipient_id=None):
    """Send SMS (or log-mode). Returns alert_deliveries id."""
    from ..models import AlertDelivery as AD

    delivered = False
    if _try_init_sms():
        try:
            import africastalking
            africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
            sms = africastalking.SMS
            sms.send(message, [phone], sender_id=settings.AT_SENDER_ID or None)
            delivered = True
        except Exception as exc:  # pragma: no cover
            logger.warning("SMS send failed: %s", exc)
    if not delivered:
        logger.info("[SMS log-mode] to %s: %s", phone, message)
    row = AD(
        source_type=source_type, source_id=source_id, recipient_id=recipient_id,
        recipient_phone=phone, channel="sms", status="sent", message=message,
    )
    db.session.add(row)
    db.session.flush()
    return row.id


def notify_user_and_fallback_sms(db, user, phone_fallback, title, body, data,
                                 source_type, source_id):
    """Push to app user; SMS fallback to phone (critical alerts)."""
    ids = [send_push(db, user.id, title, body, data, source_type, source_id)]
    if phone_fallback:
        ids.append(send_sms(db, phone_fallback, f"{title}: {body}",
                            source_type, source_id, user.id))
    return ids


async def get_last_seen_label(db, user_id: int) -> str:
    """Last-known-location timestamp label for alert wording."""
    res = db.session.execute(
        select(LocationPoint.recorded_at)
        .join(LocationShare, LocationPoint.share_id == LocationShare.id)
        .where(LocationShare.user_id == user_id)
        .order_by(desc(LocationPoint.recorded_at))
        .limit(1)
    )
    ts = res.scalar_one_or_none()
    return fmt_time(ts)


async def locale_for(db, user_id: int | None) -> str:
    if user_id is None:
        return "en"
    user = db.session.get(User, user_id)
    return (user.locale or "en") if user else "en"
