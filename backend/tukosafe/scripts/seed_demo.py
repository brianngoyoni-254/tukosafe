"""Seed demo data for the hackathon pitch: users, contacts, outing, venues.

Usage:
    python scripts/seed_demo.py
"""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from app.database import db
from app.models import Outing, OutingMember, TrustedContact, User, Venue


def now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def main() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()
        # Demo users (Nairobi numbers)
        brian = User(phone="+254712000001", display_name="Brian", locale="en", is_admin=True)
        amani = User(phone="+254712000002", display_name="Amani", locale="en")
        wanjiku = User(phone="+254712000003", display_name="Wanjiku", locale="sw")
        db.session.add_all([brian, amani, wanjiku])
        db.session.flush()

        # Accepted emergency contacts (bidirectional demo)
        db.session.add_all([
            TrustedContact(owner_id=brian.id, contact_user_id=amani.id,
                           contact_phone=amani.phone, contact_name="Amani",
                           group_type="emergency", status="accepted"),
            TrustedContact(owner_id=amani.id, contact_user_id=brian.id,
                           contact_phone=brian.phone, contact_name="Brian",
                           group_type="emergency", status="accepted"),
            TrustedContact(owner_id=brian.id, contact_user_id=wanjiku.id,
                           contact_phone=wanjiku.phone, contact_name="Wanjiku",
                           group_type="close_friends", status="accepted"),
        ])

        # Demo outing tonight
        outing = Outing(
            creator_id=brian.id, title="Blankets & Wine — Safety Circle",
            venue_name="Uhuru Gardens, Nairobi",
            starts_at=now() - dt.timedelta(hours=1),
            ends_at=now() + dt.timedelta(hours=6),
            invite_code="DEMO123",
        )
        db.session.add(outing)
        db.session.flush()
        for uid, role in [(brian.id, "organizer"), (amani.id, "member"), (wanjiku.id, "member")]:
            db.session.add(OutingMember(
                outing_id=outing.id, user_id=uid, role=role,
                status="joined", joined_at=now()))

        # Verified partner venues (Nairobi)
        db.session.add_all([
            Venue(name="The Alchemist", lat=-1.2567, lng=36.8036,
                  address="Nairobi", status="verified",
                  safety_features={"trained_staff": True, "safe_waiting_room": True,
                                   "emergency_protocol": True},
                  verified_at=now()),
            Venue(name="Uhuru Gardens", lat=-1.3267, lng=36.8063,
                  address="Nairobi", status="verified",
                  safety_features={"trained_staff": True, "first_aid": True,
                                   "well_lit_exits": True},
                  verified_at=now()),
            Venue(name="K1 Klub House", lat=-1.2639, lng=36.8028,
                  address="Nairobi", status="pending",
                  safety_features={"trained_staff": False}),
        ])
        db.session.commit()
    print("Seeded: 3 users (Brian admin, Amani, Wanjiku), contacts, 1 outing (DEMO123), 3 venues.")


if __name__ == "__main__":
    main()
