"""Core MVP e2e flows for the TukoSafe Flask backend."""
from __future__ import annotations


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_auth_otp_flow(client):
    phone = "+254712999001"
    r = client.post("/auth/otp/request", json={"phone": phone})
    assert r.status_code == 200
    body = r.get_json()
    assert body["message"]
    assert body["expires_in_seconds"] == 300
    r = client.post("/auth/otp/verify", json={"phone": phone, "code": "000000"})
    assert r.status_code == 401
    code = body.get("debug_code")
    assert code is not None
    r = client.post("/auth/otp/verify", json={"phone": phone, "code": code,
                                              "display_name": "New User"})
    assert r.status_code == 200, r.get_json()
    data = r.get_json()
    assert "access_token" in data and "refresh_token" in data
    assert data["user"]["phone"] == phone


def test_contacts_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/contacts", json={
        "phone": "+254712999002", "name": "Friend", "group_type": "emergency",
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    contact = r.get_json()
    assert contact["status"] == "pending"
    r = client.get("/contacts", headers=headers)
    assert r.status_code == 200
    assert len(r.get_json()) == 1
    r = client.get("/contacts/invites", headers=headers)
    assert r.status_code == 200


def test_outing_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/outings", json={
        "title": "Saturday Night Out",
        "venue_name": "Uhuru Gardens",
        "starts_at": "2026-12-01T18:00:00+00:00",
        "ends_at": "2026-12-01T23:00:00+00:00",
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    outing = r.get_json()
    assert outing["title"] == "Saturday Night Out"
    assert outing["invite_code"]
    r = client.get("/outings", headers=headers)
    assert r.status_code == 200
    assert len(r.get_json()) >= 1
    r = client.get(f"/outings/{outing['id']}", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["id"] == outing["id"]


def test_checkin_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/outings", json={
        "title": "Check-in Outing",
        "starts_at": "2026-12-01T18:00:00+00:00",
        "ends_at": "2026-12-01T23:00:00+00:00",
    }, headers=headers)
    outing = r.get_json()
    r = client.post("/checkins", json={
        "outing_id": outing["id"],
        "due_in_minutes": 0,
        "grace_min": 0,
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    checkin = r.get_json()
    assert checkin["state"] == "SCHEDULED"
    r = client.post(f"/checkins/{checkin['id']}/confirm", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["state"] == "RESOLVED"


def test_share_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/shares", json={
        "scope": "outing",
        "duration_minutes": 60,
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    share = r.get_json()
    assert share["scope"] == "outing"
    r = client.get("/shares/active", headers=headers)
    assert r.status_code == 200
    r = client.post(f"/shares/{share['id']}/points", json={
        "lat": -1.2921, "lng": 36.8219, "accuracy_m": 10,
    }, headers=headers)
    assert r.status_code == 202
    r = client.post(f"/shares/{share['id']}/stop", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["ended_at"] is not None


def test_sos_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/sos", json={
        "lat": -1.2921, "lng": 36.8219, "mode": "silent",
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    sos = r.get_json()
    assert sos["state"] == "ACTIVE"
    r = client.get("/sos/active/mine", headers=headers)
    assert r.status_code == 200
    r = client.post(f"/sos/{sos['id']}/cancel", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["state"] == "CANCELLED"


def test_journey_flow(client, seed_user):
    uid, headers = seed_user
    r = client.post("/journeys", json={
        "dest_lat": -1.2921, "dest_lng": 36.8219,
        "dest_name": "Home", "eta_in_minutes": 60,
        "live_share": True,
    }, headers=headers)
    assert r.status_code == 201, r.get_json()
    journey = r.get_json()
    assert journey["state"] == "ACTIVE"
    r = client.post(f"/journeys/{journey['id']}/arrive", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["state"] == "ARRIVED"


def test_get_me_home(client, seed_user):
    uid, headers = seed_user
    client.post("/contacts", json={
        "phone": "+254712999003", "name": "Mom", "group_type": "emergency",
    }, headers=headers)
    r = client.post("/get-me-home", json={
        "option": 1, "message": "Please call me",
    }, headers=headers)
    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body["ok"] is True
    assert body["alert_ids"]


def test_venues(client, seed_user):
    uid, headers = seed_user
    r = client.get("/venues?lat=-1.2921&lng=36.8219&radius=5000", headers=headers)
    assert r.status_code == 200
    assert isinstance(r.get_json(), list)
    r = client.post("/venues/apply", json={
        "name": "Test Cafe", "lat": -1.2921, "lng": 36.8219,
        "address": "Nairobi",
        "safety_features": {"trained_staff": True},
    }, headers=headers)
    assert r.status_code == 201, r.get_json()


def test_admin_stats(client, seed_user):
    uid, headers = seed_user
    from app import create_app
    from app.database import db
    from app.models import User
    app = create_app()
    with app.app_context():
        user = db.session.get(User, uid)
        user.is_admin = True
        db.session.commit()
    r = client.get("/admin/stats", headers=headers)
    assert r.status_code == 200
    body = r.get_json()
    assert body["ok"] is True
    assert "counts" in body


def test_delete_my_data(client, seed_user):
    uid, headers = seed_user
    r = client.delete("/me", headers=headers)
    assert r.status_code == 200
    assert r.get_json()["ok"] is True
