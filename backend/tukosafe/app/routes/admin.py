"""Admin dashboard APIs: users, audit, alerts, venues, abuse reports."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, jsonify, request
from sqlalchemy import desc, func, select

from ..database import db
from ..deps import get_current_admin, get_current_user
from ..models import AbuseReport, AlertDelivery, AuditLog, User, Venue, utcnow

router = Blueprint("admin", __name__, url_prefix="")


@router.post("/reports", status_code=201)
def file_report():
    """Block-and-report tool (abuse resistance)."""
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    r = AbuseReport(
        reporter_id=user.id,
        reported_user_id=body.get("reported_user_id"),
        reason=(body.get("reason") or "")[:120],
        details=body.get("details"),
    )
    db.session.add(r)
    db.session.commit()
    return jsonify({"ok": True, "report_id": r.id})


@router.get("/admin/stats")
def stats():
    _admin = get_current_admin()
    counts = {}
    for model, key in [(User, "users"), (AlertDelivery, "alert_deliveries"),
                       (Venue, "venues"), (AbuseReport, "reports")]:
        counts[key] = (
            db.session.execute(select(func.count()).select_from(model))
        ).scalar() or 0
    return jsonify({"ok": True, "counts": counts, "at": utcnow().isoformat()})


@router.get("/admin/users")
def admin_users():
    _admin = get_current_admin()
    rows = db.session.execute(
        select(User).order_by(desc(User.id)).limit(200)
    ).scalars().all()
    return jsonify([{
        "id": u.id, "phone": u.phone, "display_name": u.display_name,
        "email": u.email, "locale": u.locale, "mfa_enabled": u.mfa_enabled,
        "is_admin": u.is_admin,
    } for u in rows])


@router.get("/admin/audit-logs")
def audit_logs():
    _admin = get_current_admin()
    rows = db.session.execute(
        select(AuditLog).order_by(desc(AuditLog.id)).limit(200)
    ).scalars().all()
    return jsonify([{
        "id": a.id, "actor_id": a.actor_id, "action": a.action,
        "entity": a.entity, "entity_id": a.entity_id, "ip": a.ip,
        "meta": a.meta,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    } for a in rows])


@router.get("/admin/alerts")
def alerts():
    _admin = get_current_admin()
    rows = db.session.execute(
        select(AlertDelivery).order_by(desc(AlertDelivery.id)).limit(200)
    ).scalars().all()
    return jsonify([{
        "id": r.id, "source_type": r.source_type, "source_id": r.source_id,
        "recipient_id": r.recipient_id, "recipient_phone": r.recipient_phone,
        "channel": r.channel, "status": r.status, "message": r.message,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
        "ack_at": r.ack_at.isoformat() if r.ack_at else None,
    } for r in rows])


@router.get("/admin/reports")
def admin_reports():
    _admin = get_current_admin()
    rows = db.session.execute(
        select(AbuseReport).order_by(desc(AbuseReport.id)).limit(200)
    ).scalars().all()
    return jsonify([{
        "id": r.id, "reporter_id": r.reporter_id,
        "reported_user_id": r.reported_user_id, "reason": r.reason,
        "state": r.state,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows])


@router.post("/admin/reports/<int:report_id>/review")
def review_report(report_id: int):
    _admin = get_current_admin()
    r = db.session.get(AbuseReport, report_id)
    if r is None:
        abort(404, "Report not found")
    r.state = "reviewed"
    db.session.commit()
    return jsonify({"ok": True})


@router.get("/admin/venues")
def all_venues():
    _admin = get_current_admin()
    rows = db.session.execute(
        select(Venue).order_by(desc(Venue.id))
    ).scalars().all()
    return jsonify([v.to_dict() for v in rows])


@router.post("/admin/venues/<int:venue_id>/verify")
def verify_venue(venue_id: int):
    _admin = get_current_admin()
    v = db.session.get(Venue, venue_id)
    if v is None:
        abort(404, "Venue not found")
    v.status = "verified"
    v.verified_at = dt.datetime.now(dt.timezone.utc)
    db.session.commit()
    db.session.refresh(v)
    return jsonify(v.to_dict())


@router.post("/admin/venues/<int:venue_id>/suspend")
def suspend_venue(venue_id: int):
    _admin = get_current_admin()
    v = db.session.get(Venue, venue_id)
    if v is None:
        abort(404, "Venue not found")
    v.status = "suspended"
    db.session.commit()
    db.session.refresh(v)
    return jsonify(v.to_dict())
