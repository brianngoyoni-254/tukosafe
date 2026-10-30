"""Safe Venue Network: nearby verified venues + safety requests."""
from __future__ import annotations

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import select

from ..database import db
from ..deps import get_current_user
from ..models import SafetyRequest, User, Venue, VenueStaff
from ..services import notifications as N
from ..services.geo import haversine_m

router = Blueprint("venues", __name__, url_prefix="/venues")


@router.get("")
def nearby():
    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    radius = request.args.get("radius", default=5000, type=int)
    if lat is None or lng is None:
        abort(422, "lat and lng are required")
    rows = db.session.execute(
        select(Venue).where(Venue.status == "verified")
    ).scalars().all()
    out = []
    for v in rows:
        d = haversine_m(lat, lng, v.lat, v.lng)
        if d <= radius:
            vo = v.to_dict(distance_m=round(d, 1))
            out.append(vo)
    out.sort(key=lambda v: v["distance_m"] or 0)
    return jsonify(out)


@router.get("/<int:venue_id>")
def get_venue(venue_id: int):
    v = db.session.get(Venue, venue_id)
    if v is None:
        abort(404, "Venue not found")
    return jsonify(v.to_dict())


@router.post("/apply", status_code=201)
def apply():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    v = Venue(
        name=(body.get("name") or "").strip()[:200],
        lat=body.get("lat"), lng=body.get("lng"),
        address=body.get("address"),
        status="pending",
        safety_features=dict(body.get("safety_features") or {}),
    )
    db.session.add(v)
    db.session.commit()
    db.session.refresh(v)
    return jsonify(v.to_dict())


@router.post("/safety-request", status_code=201)
def safety_request():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    v = db.session.get(Venue, body.get("venue_id"))
    if v is None:
        abort(404, "Venue not found")
    if v.status != "verified":
        abort(422, "Venue is not a verified TukoSafe partner")
    req = SafetyRequest(
        user_id=user.id, venue_id=v.id,
        type=(body.get("type") or "ask_staff_for_help")[:64],
        note=body.get("note"),
    )
    db.session.add(req)
    db.session.flush()
    staff = db.session.execute(
        select(VenueStaff).where(VenueStaff.venue_id == v.id)
    ).scalars().all()
    for s in staff:
        N.send_push(
            db, s.user_id, f"TukoSafe safety request — {v.name}",
            f"{user.display_name or 'A guest'} asked staff for help. Please follow the venue safety protocol.",
            {"type": "safety_request", "request_id": req.id, "venue_id": v.id},
            "venue", req.id,
        )
    db.session.commit()
    return jsonify({
        "ok": True, "request_id": req.id,
        "detail": "Venue staff have been notified. Stay where you feel safest.",
    })
