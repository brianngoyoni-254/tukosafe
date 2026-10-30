"""Pytest fixtures for TukoSafe Flask backend."""
from __future__ import annotations

import datetime as dt

import pytest

from app import create_app
from app.database import db
from app.models import (
    Checkin, Outing, OutingMember, ReturnPlan, TrustedContact, User,
    utcnow,
)


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["JWT_SECRET_KEY"] = "test-secret"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Register + login a user, return Bearer auth headers."""
    phone = "+254712000001"
    # OTP request (creates code)
    client.post("/auth/otp/request", json={"phone": phone})
    # verify -> creates user + returns tokens
    resp = client.post("/auth/otp/verify", json={
        "phone": phone, "code": "000000", "display_name": "Test User",
    })
    assert resp.status_code == 200, resp.get_json()
    tokens = resp.get_json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
def seed_user(app, client):
    """Create a known user and return its id + auth headers."""
    with app.app_context():
        user = User(phone="+254712000002", display_name="Seed User")
        db.session.add(user)
        db.session.commit()
        uid = user.id
    # Login
    client.post("/auth/otp/request", json={"phone": "+254712000002"})
    resp = client.post("/auth/otp/verify", json={
        "phone": "+254712000002", "code": "000000", "display_name": "Seed User",
    })
    tokens = resp.get_json()
    return uid, {"Authorization": f"Bearer {tokens['access_token']}"}
