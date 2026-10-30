"""FR-2.x / FR-3.x / FR-7.x � outings, Safety Circles, return-home plans, check-ins."""
from __future__ import annotations

import datetime as dt
import logging

from flask import Blueprint, abort, request, jsonify
from sqlalchemy import desc, select

from ..database import db
from ..deps import get_client_ip, get_current_user
from ..models import (
    Checkin, LocationPoint, LocationShare, Outing, OutingMember,
    ReturnPlan, SosEvent, TrustedContact, User, utcnow,
)
from ..schemas import (
    CheckinCreate, CheckinOut, MemberOut, OutingCreate, OutingDetail,
    OutingInvite, OutingJoin, OutingOut, ReturnPlanOut, ReturnPlanUpsert,
)
from ..services import audit
from ..services import notifications as N
from ..realtime import broadcast

logger = logging.getLogger("tukosafe.outings")
router = Blueprint("outings", __name__, url_prefix="/outings")


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _outing_out(o: Outing) -> dict:
    return {
        "id": o.id, "creator_id": o.creator_id, "title": o.title,
        "venue_name": o.venue_name, "venue_id": o.venue_id,
        "starts_at": o.starts_at.isoformat() if o.starts_at else None,
        "ends_at": o.ends_at.isoformat() if o.ends_at else None,
        "status": o.status, "invite_code": o.invite_code,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


def _get_outing(outing_id: int) -> Outing:
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    return outing


def _require_member(outing_id: int, user_id: int) -> OutingMember:
    m = db.session.execute(
        select(OutingMember).where(
            OutingMember.outing_id == outing_id, OutingMember.user_id == user_id
        )
    ).scalar_one_or_none()
    if m is None or m.status != "joined":
        abort(403, "You are not an active member of this outing")
    return m


def _member_view(outing: Outing, m: OutingMember) -> dict:
    user = db.session.get(User, m.user_id)
    chip = "green"
    sos = db.session.execute(
        select(SosEvent).where(SosEvent.user_id == user.id, SosEvent.state == "ACTIVE").limit(1)
    ).scalar_one_or_none()
    if sos is not None:
        chip = "red"
    else:
        ci = db.session.execute(
            select(Checkin).where(
                Checkin.user_id == user.id, Checkin.outing_id == outing.id,
                Checkin.state.in_(["GRACE_PERIOD", "CONTACT_ALERTED"]),
            ).limit(1)
        ).scalar_one_or_none()
        if ci is not None:
            chip = "yellow"
    lat = lng = seen = None
    share = db.session.execute(
        select(LocationShare).where(
            LocationShare.user_id == user.id,
            LocationShare.scope == "outing",
            LocationShare.outing_id == outing.id,
            LocationShare.ended_at.is_(None),
            LocationShare.expires_at > _now(),
        ).order_by(desc(LocationShare.id)).limit(1)
    ).scalar_one_or_none()
    if share is not None:
        latest = db.session.execute(
            select(LocationPoint).where(LocationPoint.share_id == share.id)
            .order_by(desc(LocationPoint.recorded_at)).limit(1)
        ).scalar_one_or_none()
        if latest:
            lat, lng = latest.lat, latest.lng
            seen = latest.recorded_at.isoformat() if latest.recorded_at else None
    return {
        "user_id": user.id, "display_name": user.display_name, "phone": user.phone,
        "role": m.role, "status": m.status, "status_chip": chip,
        "last_lat": lat, "last_lng": lng, "last_updated_at": seen,
    }


# ---------- Outings ----------

@router.post("", status_code=201)
def create_outing():
    user = get_current_user()
    body = request.get_json(silent=True) or {}
    invite_code = body.get("invite_code") or _now().strftime("%H%M%S")[-6:]
    o = Outing(
        creator_id=user.id, title=body.get("title", "Untitled outing"),
        venue_name=body.get("venue_name"), venue_id=body.get("venue_id"),
        starts_at=_parse_dt(body.get("starts_at")),
        ends_at=_parse_dt(body.get("ends_at")),
        status="active", invite_code=invite_code,
    )
    db.session.add(o)
    db.session.flush()
    db.session.add(OutingMember(outing_id=o.id, user_id=user.id, role="organizer",
                                status="joined", joined_at=_now()))
    db.session.commit()
    return jsonify(_outing_out(o)), 201


@router.get("")
def list_outings():
    user = get_current_user()
    rows = db.session.execute(
        select(Outing).join(OutingMember).where(
            OutingMember.user_id == user.id, OutingMember.status == "joined"
        ).order_by(desc(Outing.id)).limit(50)
    ).scalars().all()
    return jsonify([_outing_out(o) for o in rows])


@router.get("/<int:outing_id>")
def get_outing(outing_id: int):
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    _require_member(outing_id, user.id)
    members = []
    for m in outing.members:
        members.append(_member_view(db.session, outing, m))
    detail = _outing_out(outing)
    detail["members"] = members
    return jsonify(detail)


@router.post("/<int:outing_id>/invite")
def invite(outing_id: int):
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    _require_member(outing_id, user.id)
    body = request.get_json(silent=True) or {}
    phones = body.get("phones", [])
    created = []
    for phone in phones:
        phone = phone.strip()
        if not phone:
            continue
        contact_user = db.session.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
        m = db.session.execute(
            select(OutingMember).where(
                OutingMember.outing_id == outing_id,
                OutingMember.user_id == contact_user.id,
            )
        ).scalar_one_or_none()
        if contact_user and m is None:
            db.session.add(OutingMember(outing_id=outing.id, user_id=contact_user.id,
                                        role="member", status="invited"))
            created.append(phone)
            N.send_push(
                db, contact_user.id, "TukoSafe invitation",
                f"{user.display_name or user.phone} invited you to '{outing.title}'. "
                f"Open TukoSafe to join with code {outing.invite_code}.",
                {"type": "outing_invite", "outing_id": outing.id}, "outing", outing.id,
            )
    db.session.commit()
    return jsonify({"ok": True, "invited": created})


@router.post("/<int:outing_id>/join")
def join(outing_id: int):
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    body = request.get_json(silent=True) or {}
    code = body.get("invite_code") or outing.invite_code
    if code != outing.invite_code:
        abort(403, "Invalid invite code")
    m = db.session.execute(
        select(OutingMember).where(
            OutingMember.outing_id == outing_id, OutingMember.user_id == user.id
        )
    ).scalar_one_or_none()
    if m is None:
        db.session.add(OutingMember(
            outing_id=outing.id, user_id=user.id, role="member",
            status="joined", joined_at=_now(),
        ))
    else:
        m.status = "joined"
        m.joined_at = _now()
        m.left_at = None
    db.session.commit()
    return jsonify({"ok": True, "outing": _outing_out(outing)})


@router.post("/<int:outing_id>/leave")
def leave(outing_id: int):
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    m = db.session.execute(
        select(OutingMember).where(
            OutingMember.outing_id == outing_id, OutingMember.user_id == user.id
        )
    ).scalar_one_or_none()
    if m is None:
        abort(403, "Not a member of this outing")
    m.status = "left"
    m.left_at = _now()
    db.session.commit()
    broadcast(outing_id, {"type": "member_left", "user_id": user.id})
    return jsonify({"ok": True})


@router.put("/<int:outing_id>/return-plan")
def upsert_return_plan(outing_id: int):
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    _require_member(outing_id, user.id)
    body = request.get_json(silent=True) or {}
    plan = db.session.execute(
        select(ReturnPlan).where(
            ReturnPlan.outing_id == outing_id, ReturnPlan.user_id == user.id
        )
    ).scalar_one_or_none()
    if plan is None:
        plan = ReturnPlan(outing_id=outing.id, user_id=user.id)
        db.session.add(plan)
        db.session.flush()
    plan.venue = body.get("venue")
    plan.depart_at = _parse_dt(body.get("depart_at"))
    plan.eta_home_at = _parse_dt(body.get("eta_home_at"))
    plan.transport = body.get("transport")
    plan.notify_contact_id = body.get("notify_contact_id")
    plan.checkin_interval_min = int(body.get("checkin_interval_min", 60))
    plan.grace_min = int(body.get("grace_min", 15))
    db.session.commit()
    db.session.refresh(plan)
    return jsonify({
        "id": plan.id, "outing_id": plan.outing_id, "user_id": plan.user_id,
        "venue": plan.venue, "depart_at": plan.depart_at.isoformat() if plan.depart_at else None,
        "eta_home_at": plan.eta_home_at.isoformat() if plan.eta_home_at else None,
        "transport": plan.transport, "notify_contact_id": plan.notify_contact_id,
        "checkin_interval_min": plan.checkin_interval_min, "grace_min": plan.grace_min,
        "arrived_at": plan.arrived_at.isoformat() if plan.arrived_at else None,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
    })


@router.post("/<int:outing_id>/arrive")
def arrive(outing_id: int):
    """FR-3.5 � 'I\'m home' closes the plan and notifies the chosen contact."""
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    _require_member(outing_id, user.id)
    plan = db.session.execute(
        select(ReturnPlan).where(
            ReturnPlan.outing_id == outing_id, ReturnPlan.user_id == user.id
        )
    ).scalar_one_or_none()
    if plan:
        plan.arrived_at = _now()
    pending = db.session.execute(
        select(Checkin).where(
            Checkin.user_id == user.id, Checkin.outing_id == outing_id,
            Checkin.state.notin_(["RESOLVED"]),
        )
    ).scalars().all()
    for c in pending:
        c.state = "RESOLVED"
        c.responded_at = _now()
    shares = db.session.execute(
        select(LocationShare).where(
            LocationShare.user_id == user.id, LocationShare.scope == "outing",
            LocationShare.outing_id == outing_id, LocationShare.ended_at.is_(None),
        )
    ).scalars().all()
    for s in shares:
        s.ended_at = _now()
    if plan and plan.notify_contact_id:
        tc = db.session.get(TrustedContact, plan.notify_contact_id)
        if tc is not None:
            name = user.display_name or user.phone
            if tc.contact_user_id:
                cu = db.session.get(User, tc.contact_user_id)
                if cu:
                    locale = N.locale_for(db.session, cu.id)
                    N.notify_user_and_fallback_sms(
                        db, cu, tc.contact_phone, "TukoSafe arrival",
                        N.msg("arrived", locale, name=name),
                        {"type": "arrived", "user_id": user.id, "outing_id": outing_id},
                        "checkin", plan.id,
                    )
                else:
                    N.send_sms(
                        db, tc.contact_phone,
                        f"TukoSafe: {N.msg('arrived', 'en', name=name)}", "checkin", plan.id,
                    )
            else:
                N.send_sms(
                    db, tc.contact_phone,
                    f"TukoSafe: {N.msg('arrived', 'en', name=name)}", "checkin", plan.id,
                )
    db.session.commit()
    broadcast(outing_id, {"type": "member_arrived", "user_id": user.id})
    return jsonify({"ok": True, "detail": "Arrival confirmed. Your contact has been notified."})


@router.post("/<int:outing_id>/lost-group")
def lost_group(outing_id: int):
    """FR-7.1 � 'I\'ve lost the group': flag + share location with participating friends."""
    user = get_current_user()
    outing = db.session.get(Outing, outing_id)
    if outing is None:
        abort(404, "Outing not found")
    _require_member(outing_id, user.id)
    share = LocationShare(
        user_id=user.id, scope="outing", outing_id=outing.id,
        audience=[], started_at=_now(),
        expires_at=_now() + dt.timedelta(minutes=60),
    )
    db.session.add(share)
    db.session.commit()
    broadcast(outing.id, {
        "type": "lost_group", "user_id": user.id,
        "note": "I\'ve lost the group � please share the meeting point.",
    })
    return jsonify({"ok": True, "share_id": share.id,
                    "detail": "Group notified. Your location is shared for 60 minutes."})


def _parse_dt(value):
    if value is None:
        return None
    if isinstance(value, dt.datetime):
        return value
    try:
        return dt.datetime.fromisoformat(value)
    except ValueError:
        return None
