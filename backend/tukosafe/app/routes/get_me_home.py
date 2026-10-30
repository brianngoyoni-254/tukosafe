"""FR-4.x — Get Me Home: one button, three discreet options."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import select

from ..database import db
from ..deps import get_client_ip, get_current_user
from ..models import TrustedContact, User
from ..services import audit
from ..services import notifications as N

router = Blueprint("get-me-home", __name__, url_prefix="")

TRANSPORT_LINKS = {
    "uber": "https://m.uber.com/go/home",
    "bolt": "https://bolt.eu/",
    "google_maps_transit": "https://www.google.com/maps/dir/?api=1&travelmode=transit",
}


@router.post("/get-me-home")
def get_me_home():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    option = int(body.get("option", 1))
    name = user.display_name or user.phone
    alert_ids = []
    transport_links = {}

    def _targets():
        contact_id = body.get("contact_id")
        if contact_id:
            tc = db.session.execute(
                select(TrustedContact).where(
                    TrustedContact.id == contact_id,
                    TrustedContact.owner_id == user.id,
                    TrustedContact.status == "accepted",
                )
            ).scalar_one_or_none()
            if tc is None:
                abort(422, "contact must be one of your accepted trusted contacts")
            return [tc]
        rows = db.session.execute(
            select(TrustedContact).where(
                TrustedContact.owner_id == user.id, TrustedContact.status == "accepted"
            )
        ).scalars().all()
        return list(rows)

    if option == 1:
        targets = _targets()
        if not targets:
            abort(422, "Add a trusted contact first")
        for tc in targets[:3]:
            text = body.get("message") or N.msg("discreet_help", "en", name=name)
            if tc.contact_user_id:
                cu = db.session.get(User, tc.contact_user_id)
                if cu:
                    locale = N.locale_for(db.session, cu.id)
                    text = body.get("message") or N.msg("discreet_help", locale, name=name)
                    ids = N.notify_user_and_fallback_sms(
                        db, cu, tc.contact_phone, "TukoSafe: a friend needs you", text,
                        {"type": "get_me_home", "option": 1, "user_id": user.id},
                        "get_me_home", user.id,
                    )
                    alert_ids.extend(ids)
                    continue
            alert_ids.append(N.send_sms(
                db, tc.contact_phone, f"TukoSafe: {text}", "get_me_home", user.id,
            ))
        detail = "Your friend has been discreetly asked to call or come help."
    elif option == 2:
        targets = _targets()
        if not targets:
            abort(422, "Add a trusted contact first")
        lat = body.get("lat"); lng = body.get("lng")
        loc = f" Location: https://maps.google.com/?q={lat},{lng}" if lat is not None and lng is not None else ""
        for tc in targets[:5]:
            text = (body.get("message") or N.msg("discreet_help", "en", name=name)) + loc
            if tc.contact_user_id:
                cu = db.session.get(User, tc.contact_user_id)
                if cu:
                    locale = N.locale_for(db.session, cu.id)
                    text = (body.get("message") or N.msg("discreet_help", locale, name=name)) + loc
                    ids = N.notify_user_and_fallback_sms(
                        db, cu, tc.contact_phone, "TukoSafe: help requested", text,
                        {"type": "get_me_home", "option": 2, "user_id": user.id,
                         "lat": lat, "lng": lng},
                        "get_me_home", user.id,
                    )
                    alert_ids.extend(ids)
                    continue
            alert_ids.append(N.send_sms(
                db, tc.contact_phone, f"TukoSafe: {text}", "get_me_home", user.id,
            ))
        detail = "Designated contacts alerted with your location."
    else:
        transport_links = dict(TRANSPORT_LINKS)
        targets = _targets()
        monitor_id = targets[0].id if targets else None
        if monitor_id:
            tc = targets[0]
            text = f"{name} is arranging a safe journey home via TukoSafe and shared this with you."
            if tc.contact_user_id:
                cu = db.session.get(User, tc.contact_user_id)
                if cu:
                    ids = N.notify_user_and_fallback_sms(
                        db, cu, tc.contact_phone, "TukoSafe: journey home", text,
                        {"type": "get_me_home", "option": 3, "user_id": user.id},
                        "get_me_home", user.id,
                    )
                    alert_ids.extend(ids)
                else:
                    alert_ids.append(N.send_sms(
                        db, tc.contact_phone, f"TukoSafe: {text}", "get_me_home", user.id,
                    ))
            else:
                alert_ids.append(N.send_sms(
                    db, tc.contact_phone, f"TukoSafe: {text}", "get_me_home", user.id,
                ))
        detail = "Transport options ready. Share your trip with a trusted contact and follow the journey."

    audit.log(db.session, "get_me_home.used", "user", user.id, user.id,
              get_client_ip(), {"option": option})
    db.session.commit()
    return jsonify({
        "ok": True, "detail": detail, "alert_ids": alert_ids,
        "transport_links": transport_links,
        "emergency_note": ("This notifies your friends — it does NOT dispatch emergency responders. "
                           "In an emergency call 999 or 112."),
    })
