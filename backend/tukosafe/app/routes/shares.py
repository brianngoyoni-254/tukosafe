"""Temporary, consent-based location sharing."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import desc, select

from ..database import db
from ..deps import get_current_user
from ..models import LocationPoint, LocationShare, OutingMember, User
from ..services import audit
from ..realtime import broadcast

router = Blueprint("shares", __name__, url_prefix="/shares")

SCOPES = {"outing", "journey", "sos"}


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.post("", status_code=201)
def start_share():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    if body.get("scope") not in SCOPES:
        abort(422, f"scope must be one of {sorted(SCOPES)}")
    if body.get("scope") == "outing":
        if not body.get("outing_id"):
            abort(422, "outing_id required for outing shares")
        m = db.session.execute(
            select(OutingMember).where(
                OutingMember.outing_id == body["outing_id"], OutingMember.user_id == user.id
            )
        ).scalar_one_or_none()
        if m is None or m.status != "joined":
            abort(403, "Join the outing before sharing location with it")
    share = LocationShare(
        user_id=user.id, scope=body.get("scope"),
        outing_id=body.get("outing_id"), journey_id=body.get("journey_id"),
        sos_id=body.get("sos_id"), audience=list(body.get("audience") or []),
        started_at=_now(),
        expires_at=_now() + dt.timedelta(minutes=int(body.get("duration_minutes", 240))),
    )
    db.session.add(share)
    audit.log(db.session, "share.started", "location_share", None, user.id,
              None, {"scope": body.get("scope")})
    db.session.commit()
    db.session.refresh(share)
    if share.outing_id:
        broadcast(share.outing_id, {
            "type": "share_started", "user_id": user.id, "share_id": share.id,
        })
    return jsonify({
        "id": share.id, "user_id": share.user_id, "scope": share.scope,
        "outing_id": share.outing_id, "journey_id": share.journey_id, "sos_id": share.sos_id,
        "audience": share.audience or [],
        "started_at": share.started_at.isoformat() if share.started_at else None,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "ended_at": share.ended_at.isoformat() if share.ended_at else None,
    })


@router.get("/active")
def active_shares():
    user = get_current_user()
    rows = db.session.execute(
        select(LocationShare).where(
            LocationShare.user_id == user.id,
            LocationShare.ended_at.is_(None),
            LocationShare.expires_at > _now(),
        ).order_by(desc(LocationShare.id))
    ).scalars().all()
    return jsonify([{
        "id": r.id, "user_id": r.user_id, "scope": r.scope,
        "outing_id": r.outing_id, "journey_id": r.journey_id, "sos_id": r.sos_id,
        "audience": r.audience or [],
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "ended_at": r.ended_at.isoformat() if r.ended_at else None,
    } for r in rows])


@router.post("/<int:share_id>/points", status_code=202)
def push_point(share_id: int):
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    share = db.session.get(LocationShare, share_id)
    if share is None:
        abort(404, "Share not found")
    if share.user_id != user.id:
        abort(403, "Only the sharer can push points to this share")
    if share.ended_at is not None or share.expires_at <= _now():
        abort(410, "Share has ended or expired")
    pt = LocationPoint(
        share_id=share.id, lat=body.get("lat"), lng=body.get("lng"),
        accuracy_m=body.get("accuracy_m"), battery_pct=body.get("battery_pct"),
        recorded_at=_now(),
    )
    db.session.add(pt)
    db.session.commit()
    if share.outing_id:
        broadcast(share.outing_id, {
            "type": "location", "user_id": user.id, "share_id": share.id,
            "lat": body.get("lat"), "lng": body.get("lng"),
            "at": pt.recorded_at.isoformat() if pt.recorded_at else None,
        })
    return jsonify({"ok": True})


@router.post("/<int:share_id>/stop")
def stop_share(share_id: int):
    """Stopping needs nobody else's permission."""
    user = get_current_user()
    share = db.session.get(LocationShare, share_id)
    if share is None:
        abort(404, "Share not found")
    if share.user_id != user.id:
        abort(403, "Only the sharer can stop this share")
    share.ended_at = _now()
    db.session.commit()
    if share.outing_id:
        broadcast(share.outing_id, {
            "type": "share_stopped", "user_id": user.id, "share_id": share.id,
        })
    return jsonify({
        "id": share.id, "user_id": share.user_id, "scope": share.scope,
        "outing_id": share.outing_id, "journey_id": share.journey_id, "sos_id": share.sos_id,
        "audience": share.audience or [],
        "started_at": share.started_at.isoformat() if share.started_at else None,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
        "ended_at": share.ended_at.isoformat() if share.ended_at else None,
    })
