# TukoSafe - Backend API 🛡️

> **Youth Social Safety & Emergency Support Platform - “Go Out. Have Fun. Get Home Safe.”**
> *TukoSafe is not an emergency service. In an emergency, call **999** or **112**.*

Python (FastAPI) backend for the **Moringa Hackathon 2026** - theme: *Human-Centered
Technology: Building Trust in Communities.*

---

## ✨ What it does (MVP scope - Project Documentation v1.0)

| Feature | Endpoints | Spec |
|---|---|---|
| Phone OTP auth + JWT + device binding | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, `GET/PUT /auth/me` | FR-1.1/1.2 |
| Trusted contacts (must **accept** first) | `GET/POST /contacts`, `/contacts/invites`, `/{id}/accept|decline`, `DELETE /{id}` | FR-1.3–1.6 |
| Outings / Safety Circles + invites | `POST /outings`, `/{id}/invite|join|leave`, `GET /outings/{id}` (group map) | FR-2.1–2.6 |
| Return-home plans + scheduled check-ins | `PUT /outings/{id}/return-plan`, `POST /checkins`, `POST /checkins/{id}/confirm`, `POST /outings/{id}/arrive` | FR-3.1–3.6 |
| Get Me Home (3 discreet options) | `POST /get-me-home` | FR-4.1–4.6 |
| Emergency SOS (ack / cancel / resolve) | `POST /sos`, `/sos/{id}/points|ack|cancel|resolve` | FR-5.1–5.5 |
| Journey tracking + arrival | `POST /journeys`, `/{id}/arrive|cancel` | FR-6.1–6.4 |
| “I’ve lost the group” flag | `POST /outings/{id}/lost-group` | FR-7.1–7.3 |
| Temporary location shares | `POST /shares`, `/shares/{id}/points|stop`, `GET /shares/active` | FR-2.3/2.5, 5.3 |
| Nearby Safe Venues + staff help | `GET /venues?lat&lng&radius`, `/venues/apply`, `/venues/safety-request` | Plus track |
| Abuse reports + admin dashboard APIs | `POST /reports`, `/admin/*` | §6.8 |
| Live group channel (WebSocket) | `WS /ws/outings/{id}?token=...` | §9 |

**Check-in escalation state machine:** `SCHEDULED → REMINDER_SENT → GRACE_PERIOD → CONTACT_ALERTED → RESOLVED`
(any state → `RESOLVED` on “I’m okay”; SOS jumps straight to alerted - §7.2/7.3).

### Architecture

```
[Expo App] <──HTTPS/WSS──> [FastAPI] <──> [PostgreSQL+PostGIS | SQLite (demo)]
                                │  └────> [Redis: pub/sub] (optional)
                                ├──> [APScheduler worker: check-ins, expiry, purge]
                                ├──> [FCM push] ──fallback──> [SMS provider]
                                └──> [Admin / venue dashboard APIs]
```

Push-first alerts with **SMS fallback**, every delivery recorded in `alert_deliveries`.
Providers are optional - without credentials the API runs in **log-mode** so the demo
works with zero setup. Notifications are bilingual (English / Kiswahili), calm and
verification-first (see `app/services/notifications.py`).

---

## 🚀 Quickstart (2 minutes, zero setup)

```bash
cd tukosafe
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/seed_demo.py        # demo users, outing (code DEMO123), venues
uvicorn app.main:app --reload      # API at http://localhost:8000
```

- Interactive docs: **http://localhost:8000/docs**
- Health check: `curl localhost:8000/health`

### Docker (production-like: PostGIS + Redis)

```bash
cp .env.example .env
docker compose up --build
```

### Run tests

```bash
pytest -q
```

---

## 🎤 5-minute judges demo script

1. **Register two users** (`POST /auth/otp/request` → use `debug_code` → `/auth/otp/verify` as Brian & Amani).
2. **Brian adds Amani** as `emergency` contact; **Amani accepts** (`/contacts/invites` → `/accept`).
   👉 *Trust point: nobody is tracked without mutual consent.*
3. **Brian creates outing** “Saturday Night Out”, invites Amani; Amani joins.
4. **Amani starts a share** (`POST /shares` scope `outing`) and pushes a point
   (`-1.2921, 36.8219`); **Brian sees her on the group map** (`GET /outings/{id}`).
5. **Schedule a check-in due now** (`due_in_minutes: 0, grace_min: 0`), wait ~30s -
   the worker escalates and **Amani gets the calm verification alert**.
6. **Trigger SOS** (`POST /sos` silent mode) → instant alert → **Amani acks** → Brian resolves.
7. **Get Me Home option 1** → discreet “call me” message. **Start a journey** →
   **arrive** → monitor contact notified.
8. Open `/docs` and `HUMAN_IMPACT.md` for the trust story.

Seeded shortcut: run `python scripts/seed_demo.py` and join outing code **DEMO123**.

---

## 🔐 Privacy, security & compliance

- Time-boxed consent (`expires_at` on every share), instant stop, mutual acceptance,
  block-and-report, short location retention (`LOCATION_RETENTION_DAYS=7`), export/delete-my-data.
- Short-lived JWTs + refresh rotation, OTP rate limiting, audit log on every
  sensitive action, TLS-ready, secrets via env/vault.
- Designed for **Kenya Data Protection Act, 2019** (consent basis, DPIA-ready,
  data-subject rights) - see `HUMAN_IMPACT.md`. Legal review required before launch.
- 18+ recommended for MVP; under-18 is a separate legally-reviewed track.

## ⚠️ Honest limits

GPS can fail, phones die, alerts get missed. Notifying friends is **not**
dispatching responders - every critical screen carries the 999/112 notice.

## 🧰 Tech stack

FastAPI · SQLAlchemy 2 (async) · PostgreSQL+PostGIS / SQLite · APScheduler worker
(Celery/ARQ-ready) · WebSockets (+Redis pub/sub) · FCM + Africa’s Talking (log-mode fallback).

## 🤖 AI disclosure (hackathon compliance)

Built with AI coding assistance (code generation, reviewed and tested by the team),
plus project documentation v1.0 as the requirements source. No user data involved.

## 👥 Team roles (edit me)

- Backend - …
- Mobile (Expo) - …
- Design - …
- Safety/community & pitch - …

## 📁 Repo layout

```
app/            # FastAPI app (routers, services, worker, ws)
scripts/seed_demo.py
tests/          # e2e MVP flows incl. escalation state machine
Dockerfile docker-compose.yml
HUMAN_IMPACT.md # human-impact & trust statement (submission deliverable)
```
