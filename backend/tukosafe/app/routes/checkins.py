"""Canonical /checkins endpoints (FR-3.x, state machine)."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import desc, select

from ..database import db
from ..deps import get_current_user
from ..models import Checkin, OutingMember, User
from ..realtime import broadcast

router = Blueprint("checkins", __name__, url_prefix="/checkins")


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


@router.post("", status_code=201)
def schedule_checkin():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    if body.get("outing_id"):
        m = db.session.execute(
            select(OutingMember).where(
                OutingMember.outing_id == body["outing_id"], OutingMember.user_id == user.id
            )
        ).scalar_one_or_none()
        if m is None or m.status != "joined":
            abort(403, "You are not an active member of this outing")
    due = _now() + dt.timedelta(minutes=int(body.get("due_in_minutes", 60)))
    c = Checkin(
        user_id=user.id,
        plan_id=body.get("plan_id"),
        outing_id=body.get("outing_id"),
        due_at=due,
        grace_until=due + dt.timedelta(minutes=int(body.get("grace_min", 15))),
    )
    db.session.add(c)
    db.session.commit()
    db.session.refresh(c)
    return jsonify({
        "id": c.id, "user_id": c.user_id, "plan_id": c.plan_id,
        "outing_id": c.outing_id, "due_at": c.due_at.isoformat() if c.due_at else None,
        "grace_until": c.grace_until.isoformat() if c.grace_until else None,
        "responded_at": c.responded_at.isoformat() if c.responded_at else None,
        "state": c.state, "created_at": c.created_at.isoformat() if c.created_at else None,
    })


@router.get("/mine")
def my_checkins():
    user = get_current_user()
    rows = db.session.execute(
        select(Checkin).where(Checkin.user_id == user.id)
        .order_by(desc(Checkin.id)).limit(50)
    ).scalars().all()
    return jsonify([{
        "id": r.id, "user_id": r.user_id, "plan_id": r.plan_id,
        "outing_id": r.outing_id, "due_at": r.due_at.isoformat() if r.due_at else None,
        "grace_until": r.grace_until.isoformat() if r.grace_until else None,
        "responded_at": r.responded_at.isoformat() if r.responded_at else None,
        "state": r.state, "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows])


@router.get("/<int:checkin_id>")
def get_checkin(checkin_id: int):
    user = get_current_user()
    c = db.session.get(Checkin, checkin_id)
    if c is None:
        abort(404, "Check-in not found")
    if c.user_id != user.id:
        abort(403, "Only the owner can view this check-in")
    return jsonify({
        "id": c.id, "user_id": c.user_id, "plan_id": c.plan_id,
        "outing_id": c.outing_id, "due_at": c.due_at.isoformat() if c.due_at else None,
        "grace_until": c.grace_until.isoformat() if c.grace_until else None,
        "responded_at": c.responded_at.isoformat() if c.responded_at else None,
        "state": c.state, "created_at": c.created_at.isoformat() if c.created_at else None,
    })


@router.post("/<int:checkin_id>/confirm")
def confirm_checkin(checkin_id: int):
    """'I\'m okay' — resolves from ANY state (state machine)."""
    user = get_current_user()
    c = db.session.get(Checkin, checkin_id)
    if c is None:
        abort(404, "Check-in not found")
    if c.user_id != user.id:
        abort(403, "Only the owner can confirm this check-in")
    c.state = "RESOLVED"
    c.responded_at = _now()
    db.session.commit()
    if c.outing_id:
        broadcast(c.outing_id, {
            "type": "checkin_confirmed", "user_id": user.id, "checkin_id": c.id,
        })
    return jsonify({
        "id": c.id, "user_id": c.user_id, "plan_id": c.plan_id,
        "outing_id": c.outing_id, "due_at": c.due_at.isoformat() if c.due_at else None,
        "grace_until": c.grace_until.isoformat() if c.grace_until else None,
        "responded_at": c.responded_at.isoformat() if c.responded_at else None,
        "state": c.state, "created_at": c.created_at.isoformat() if c.created_at else None,
    })
