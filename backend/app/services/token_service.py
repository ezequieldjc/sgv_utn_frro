from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jose import ExpiredSignatureError, JWTError

from app.core.errors import APIError
from app.core.security import create_access_token, create_refresh_token, decode_token


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str


def issue_token_pair(
    user_id: int,
    rol_id: int,
    permisos: list[str],
    version_token: int,
    access_minutes: int,
    refresh_minutes: int,
) -> TokenPair:
    return TokenPair(
        access_token=create_access_token(user_id, rol_id, permisos, version_token, access_minutes),
        refresh_token=create_refresh_token(user_id, version_token, refresh_minutes),
    )


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = decode_token(token)
    except ExpiredSignatureError as exc:
        raise APIError(401, "TOKEN_EXPIRADO", "El token expiró") from exc
    except JWTError as exc:
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido") from exc

    if payload.get("typ") != "access":
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido")
    return payload
