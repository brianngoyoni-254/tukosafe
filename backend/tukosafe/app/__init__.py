"""TukoSafe Flask application factory.

Go Out. Have Fun. Get Home Safe.
TukoSafe is NOT an emergency service. In an emergency, call 999 or 112.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

from .config import Settings
from .database import db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s: %(message)s")
logger = logging.getLogger("tukosafe")

jwt = JWTManager()
migrate = Migrate()


def _sync_db_url(url: str) -> str:
    """Convert async SQLAlchemy URLs to sync equivalents for Flask-SQLAlchemy."""
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    return url


def create_app(settings: Settings | None = None):
    if settings is None:
        settings = Settings()

    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=settings.SECRET_KEY,
        JWT_SECRET_KEY=settings.SECRET_KEY,
        JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        SQLALCHEMY_DATABASE_URI=_sync_db_url(settings.DATABASE_URL),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )

    origins = settings.cors_origins
    CORS(app, resources={r"/*": {"origins": origins}}, supports_credentials=True)

    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    @jwt.invalid_token_loader
    def _invalid_token(reason):
        return jsonify({"error": "invalid_token", "message": reason}), 401

    @jwt.unauthorized_loader
    def _missing_token(reason):
        return jsonify({"error": "missing_token", "message": reason}), 401

    @jwt.expired_token_loader
    def _expired_token(header, payload):
        return jsonify({"error": "token_expired", "message": "Token has expired"}), 401

    from .routes import register_blueprints
    register_blueprints(app)

    with app.app_context():
        from . import models  # noqa: F401  (register models on db.Model)
        db.create_all()

    from .worker import start_scheduler
    app.state.scheduler = start_scheduler(app)

    logger.info(
        "TukoSafe API ready (database=%s)",
        "postgres" if settings.DATABASE_URL.startswith("postgresql") else "sqlite",
    )
    return app
