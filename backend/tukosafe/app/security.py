"""JWT + phone-OTP helpers (Flask port)."""
from __future__ import annotations

import datetime as dt
import hashlib
import random

from flask import abort, current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from sqlalchemy import func, select

from .database import db
from .models import OtpCode, utcnow

OTP_TTL_SECONDS = 300
OTP_MAX_ATTEMPTS = 5
OTP_MAX_PER_HOUR = 5


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _hash_code(code: str) -> str:
    secret = current_app.config.get("SECRET_KEY", "change-me-in-production")
    return hashlib.sha256(f"{secret}:{code}".encode()).hexdigest()


def issue_otp(phone: str):
    """Rate-limited OTP issuance. Returns (plain_code, row)."""
    since = _now() - dt.timedelta(hours=1)
    count = (
        db.session.execute(
            select(func.count()).select_from(OtpCode).where(
                OtpCode.phone == phone, OtpCode.created_at >= since
            )
        )
    ).scalar() or 0
    if count >= OTP_MAX_PER_HOUR:
        abort(429, "Too many OTP requests. Try again later.")
    code = f"{random.randint(0, 999999):06d}"
    row = OtpCode(
        phone=phone,
        code_hash=_hash_code(code),
        expires_at=_now() + dt.timedelta(seconds=OTP_TTL_SECONDS),
    )
    db.session.add(row)
    db.session.commit()
    return code, row


def verify_otp(phone: str, code: str) -> bool:
    row = (
        db.session.execute(
            select(OtpCode)
            .where(OtpCode.phone == phone, OtpCode.used.is_(False))
            .order_by(OtpCode.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    if row.expires_at < _now():
        return False
    row.attempts += 1
    if row.attempts > OTP_MAX_ATTEMPTS:
        db.session.commit()
        return False
    if row.code_hash != _hash_code(code):
        db.session.commit()
        return False
    row.used = True
    db.session.commit()
    return True
