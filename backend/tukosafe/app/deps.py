"""Shared Flask helpers: current user, admin, client IP."""
from flask import abort, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import select

from .database import db
from .models import User


def get_current_user() -> User:
    verify_jwt_in_request()
    user_id = int(get_jwt_identity())
    user = (
        db.session.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        abort(401, "User not found")
    return user


def get_current_admin() -> User:
    user = get_current_user()
    if not user.is_admin:
        abort(403, "Admin only")
    return user


def get_client_ip() -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.remote_addr or "unknown"
