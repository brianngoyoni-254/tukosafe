"""Flask-SQLAlchemy database instance.

Defaults to SQLite (zero-setup hackathon demo). Set DATABASE_URL to a
postgresql+psycopg2:// URL for production use.
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
