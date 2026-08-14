from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt
from passlib.context import CryptContext

from app.core.settings import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def _build_expiration(minutes: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)


def create_access_token(
    user_id: int,
    rol_id: int,
    permisos: list[str],
    version_token: int,
    expiration_minutes: int,
) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {
        "user_id": user_id,
        "rol_id": rol_id,
        "permisos": permisos,
        "version_token": version_token,
        "exp": _build_expiration(expiration_minutes),
        "typ": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: int, version_token: int, expiration_minutes: int) -> str:
    settings = get_settings()
    payload: dict[str, Any] = {
        "user_id": user_id,
        "version_token": version_token,
        "exp": _build_expiration(expiration_minutes),
        "typ": "refresh",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
