"""FR-5.x � Emergency SOS: immediate alert, live location, ack, cancel/resolve."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import select

from ..database import db
from ..deps import get_client_ip, get_current_user
from ..models import AlertDelivery, LocationPoint, LocationShare, SosEvent, TrustedContact, User
from ..services import audit
from ..services import notifications as N
from ..realtime import broadcast

router = Blueprint("sos", __name__, url_prefix="/sos")


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _emergency_audience(user: User):
    rows = db.session.execute(
        select(TrustedContact).where(
            TrustedContact.owner_id == user.id,
            TrustedContact.status == "accepted",
            TrustedContact.group_type == "emergency",
        )
    ).scalars().all()
    rows = list(rows)
    if not rows:
        rows = list(
            db.session.execute(
                select(TrustedContact).where(
                    TrustedContact.owner_id == user.id, TrustedContact.status == "accepted"
                )
            ).scalars().all()
        )
    return rows


@router.post("", status_code=201)
def trigger_sos():
    """FR-5.2 � bypasses the missed-check-in sequence entirely."""
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    sos = SosEvent(
        user_id=user.id, outing_id=body.get("outing_id"),
        lat=body.get("lat"), lng=body.get("lng"),
        mode=body.get("mode", "loud") if body.get("mode") in ("loud", "silent") else "loud",
    )
    db.session.add(sos)
    db.session.flush()

    audience = _emergency_audience(user)
    audience_ids = [t.contact_user_id for t in audience if t.contact_user_id]
    share = LocationShare(
        user_id=user.id, scope="sos", sos_id=sos.id,
        outing_id=body.get("outing_id"), audience=audience_ids,
        started_at=_now(),
        expires_at=_now() + dt.timedelta(hours=4),
    )
    db.session.add(share)
    db.session.flush()
    if body.get("lat") is not None and body.get("lng") is not None:
        db.session.add(LocationPoint(
            share_id=share.id, lat=body["lat"], lng=body["lng"], recorded_at=_now(),
        ))

    name = user.display_name or user.phone
    last_seen = N.fmt_time(_now())
    for tc in audience:
        if tc.contact_user_id:
            cu = db.session.get(User, tc.contact_user_id)
            if cu:
                locale = N.locale_for(db.session, cu.id)
                N.notify_user_and_fallback_sms(
                    db, cu, tc.contact_phone, "TukoSafe SOS � urgent help requested",
                    N.msg("sos", locale, name=name, last_seen=last_seen),
                    {"type": "sos", "sos_id": sos.id, "user_id": user.id},
                    "sos", sos.id,
                )
                continue
        N.send_sms(
            db, tc.contact_phone,
            f"TukoSafe SOS: {N.msg('sos', 'en', name=name, last_seen=last_seen)}", "sos", sos.id,
        )
    audit.log(db.session, "sos.triggered", "sos_event", sos.id, user.id, get_client_ip(),
              {"mode": sos.mode})
    db.session.commit()
    db.session.refresh(sos)
    if sos.outing_id:
        broadcast(sos.outing_id, {"type": "sos", "sos_id": sos.id, "user_id": user.id})
    return jsonify({
        "id": sos.id, "user_id": sos.user_id, "outing_id": sos.outing_id,
        "lat": sos.lat, "lng": sos.lng, "mode": sos.mode, "state": sos.state,
        "triggered_at": sos.triggered_at.isoformat() if sos.triggered_at else None,
    }), 201


@router.post("/<int:sos_id>/points", status_code=202)
def sos_points(sos_id: int):
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    sos = db.session.get(SosEvent, sos_id)
    if sos is None:
        abort(404, "SOS not found")
    if sos.user_id != user.id:
        abort(403, "Only the owner can push SOS points")
    share = db.session.execute(
        select(LocationShare).where(LocationShare.sos_id == sos.id).order_by(LocationShare.id.desc()).limit(1)
    ).scalar_one_or_none()
    if share is None:
        abort(404, "SOS location share not found")
    pt = LocationPoint(
        share_id=share.id, lat=body.get("lat"), lng=body.get("lng"),
        accuracy_m=body.get("accuracy_m"), battery_pct=body.get("battery_pct"),
        recorded_at=_now(),
    )
    db.session.add(pt)
    db.session.commit()
    broadcast(sos.outing_id or sos.id, {
        "type": "sos_location", "sos_id": sos.id, "user_id": user.id,
        "lat": body.get("lat"), "lng": body.get("lng"),
    })
    return jsonify({"ok": True})


@router.post("/<int:sos_id>/ack")
def ack_sos(sos_id: int):
    user = get_current_user()
    sos = db.session.get(SosEvent, sos_id)
    if sos is None:
        abort(404, "SOS not found")
    # Recipient check: user must be in the audience of an SOS location share,
    # or be a recorded AlertDelivery recipient for this SOS.
    share = db.session.execute(
        select(LocationShare).where(LocationShare.sos_id == sos.id)
    ).scalars().first()
    is_audience = bool(share) and user.id in (share.audience or [])
    delivery_rows = db.session.execute(
        select(AlertDelivery).where(
            AlertDelivery.source_type == "sos",
            AlertDelivery.source_id == sos.id,
            AlertDelivery.recipient_id == user.id,
        )
    ).scalars().all()
    if not is_audience and not delivery_rows:
        abort(403, "You are not a recipient of this SOS")
    delivery_rows = db.session.execute(
        select(AlertDelivery).where(
            AlertDelivery.source_type == "sos", AlertDelivery.source_id == sos.id,
        )
    ).scalars().all()
    for r in delivery_rows:
        r.status = "acked"
        r.ack_at = _now()
    if sos.state == "ACTIVE":
        sos.state = "ACKNOWLEDGED"
    owner = db.session.get(User, sos.user_id)
    if owner:
        N.send_push(
            db, owner.id, "Help is on the way",
            f"{user.display_name or user.phone} acknowledged your SOS and is responding.",
            {"type": "sos_ack", "sos_id": sos.id, "by": user.id}, "sos", sos.id,
        )
    db.session.commit()
    if sos.outing_id:
        broadcast(sos.outing_id, {"type": "sos_ack", "sos_id": sos.id, "by": user.id})
    return jsonify({"ok": True})


@router.post("/<int:sos_id>/cancel")
def cancel_sos(sos_id: int):
    user = get_current_user()
    sos = db.session.get(SosEvent, sos_id)
    if sos is None:
        abort(404, "SOS not found")
    if sos.user_id != user.id:
        abort(403, "Only the owner can cancel")
    sos.state = "CANCELLED"
    sos.cancelled_at = _now()
    shares = db.session.execute(
        select(LocationShare).where(LocationShare.sos_id == sos.id, LocationShare.ended_at.is_(None))
    ).scalars().all()
    for s in shares:
        s.ended_at = _now()
    rows = db.session.execute(
        select(AlertDelivery).where(
            AlertDelivery.source_type == "sos",
            AlertDelivery.source_id == sos.id,
        )
    ).scalars().all()
    seen = set()
    for r in rows:
        if r.recipient_id and r.recipient_id not in seen:
            seen.add(r.recipient_id)
            N.send_push(
                db, r.recipient_id, "SOS cancelled",
                f"{user.display_name or user.phone} cancelled the SOS. No further action needed.",
                {"type": "sos_cancelled", "sos_id": sos.id}, "sos", sos.id,
            )
    db.session.commit()
    if sos.outing_id:
        broadcast(sos.outing_id, {"type": "sos_cancelled", "sos_id": sos.id})
    return jsonify({
        "id": sos.id, "user_id": sos.user_id, "outing_id": sos.outing_id,
        "lat": sos.lat, "lng": sos.lng, "mode": sos.mode, "state": sos.state,
        "triggered_at": sos.triggered_at.isoformat() if sos.triggered_at else None,
    })


@router.post("/<int:sos_id>/resolve")
def resolve_sos(sos_id: int):
    user = get_current_user()
    sos = db.session.get(SosEvent, sos_id)
    if sos is None:
        abort(404, "SOS not found")
    if sos.user_id != user.id:
        abort(403, "Only the owner can resolve")
    sos.state = "RESOLVED"
    sos.resolved_at = _now()
    shares = db.session.execute(
        select(LocationShare).where(LocationShare.sos_id == sos.id, LocationShare.ended_at.is_(None))
    ).scalars().all()
    for s in shares:
        s.ended_at = _now()
    db.session.commit()
    if sos.outing_id:
        broadcast(sos.outing_id, {"type": "sos_resolved", "sos_id": sos.id})
    return jsonify({
        "id": sos.id, "user_id": sos.user_id, "outing_id": sos.outing_id,
        "lat": sos.lat, "lng": sos.lng, "mode": sos.mode, "state": sos.state,
        "triggered_at": sos.triggered_at.isoformat() if sos.triggered_at else None,
    })


@router.get("/active/mine")
def my_active_sos():
    user = get_current_user()
    rows = db.session.execute(
        select(SosEvent).where(
            SosEvent.user_id == user.id,
            SosEvent.state.in_(["ACTIVE", "ACKNOWLEDGED"]),
        )
    ).scalars().all()
    return jsonify([{
        "id": r.id, "user_id": r.user_id, "outing_id": r.outing_id,
        "lat": r.lat, "lng": r.lng, "mode": r.mode, "state": r.state,
        "triggered_at": r.triggered_at.isoformat() if r.triggered_at else None,
    } for r in rows])
