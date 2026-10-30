"""Central application configuration (python-dotenv + os.environ)."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv(".env", override=False)


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "y"}


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "TukoSafe API")
    DEBUG: bool = _env_bool("DEBUG", True)
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-use-a-long-random-string")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)
    JWT_ALGORITHM: str = "HS256"

    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./tukosafe.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    AT_USERNAME: str = os.getenv("AT_USERNAME", "")
    AT_API_KEY: str = os.getenv("AT_API_KEY", "")
    AT_SENDER_ID: str = os.getenv("AT_SENDER_ID", "TUKOSAFE")
    OTP_DEBUG_RETURN: bool = _env_bool("OTP_DEBUG_RETURN", True)

    LOCATION_RETENTION_DAYS: int = _env_int("LOCATION_RETENTION_DAYS", 7)
    DEFAULT_CHECKIN_INTERVAL_MIN: int = _env_int("DEFAULT_CHECKIN_INTERVAL_MIN", 60)
    DEFAULT_GRACE_MIN: int = _env_int("DEFAULT_GRACE_MIN", 15)

    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    @property
    def cors_origins(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql")


@lru_cache
def get_settings() -> Settings:
    return Settings()
