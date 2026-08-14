from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import APIError
from app.models.auth.usuario import Usuario
from app.schemas.auth import AuthSessionResponse
from app.services.auth_service import build_session_response
from app.services.permission_service import has_permission
from app.services.token_service import decode_access_token


def get_current_authenticated_session(session: Session, token: str | None) -> AuthSessionResponse:
    if not token:
        raise APIError(401, "TOKEN_INVALIDO", "No se encontró la cookie de autenticación")

    payload = decode_access_token(token)
    user_id = payload.get("user_id")
    version_token = payload.get("version_token")
    if not isinstance(user_id, int) or not isinstance(version_token, int):
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido")

    user = session.exec(select(Usuario).where(Usuario.id == user_id)).first()
    if user is None:
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido")

    if user.version_token != version_token:
        raise APIError(401, "TOKEN_INVALIDO", "La sesión fue revocada")

    return build_session_response(session, user)


def require_permission(
    session: Session,
    token: str | None,
    required_permission: str,
) -> AuthSessionResponse:
    current_session = get_current_authenticated_session(session, token)
    if not has_permission(current_session.permisos, required_permission):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return current_session
