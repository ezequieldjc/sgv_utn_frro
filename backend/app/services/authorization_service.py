from __future__ import annotations

from sqlmodel import Session, select

from app.core.errors import APIError
from app.models.auth.usuario import Usuario
from app.schemas.auth import AuthSessionResponse
from app.services.auth_service import build_session_response, get_latest_password_record
from app.services.permission_service import has_permission
from app.services.token_service import decode_access_token, decode_refresh_token


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


def validar_renovacion(session: Session, refresh_token: str | None) -> Usuario:
    """Valida la cookie de renovación y devuelve el usuario si su sesión sigue vigente.

    Renovar no puede devolverle el acceso a quien ya no debería tenerlo. Por eso se rechaza si el
    usuario no existe o si cambió su `version_token` (contraseña restablecida, usuario
    deshabilitado). También se rechaza, por las dudas, si está deshabilitado o si tiene que
    cambiar la contraseña.
    """
    if not refresh_token:
        raise APIError(401, "TOKEN_INVALIDO", "No se encontró la cookie de renovación")

    payload = decode_refresh_token(refresh_token)
    user_id = payload.get("user_id")
    version_token = payload.get("version_token")
    if not isinstance(user_id, int) or not isinstance(version_token, int):
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido")

    user = session.exec(select(Usuario).where(Usuario.id == user_id)).first()
    if user is None:
        raise APIError(401, "TOKEN_INVALIDO", "El token es inválido")
    if user.version_token != version_token:
        raise APIError(401, "TOKEN_INVALIDO", "La sesión fue revocada")
    if not user.habilitado:
        raise APIError(403, "USUARIO_DESHABILITADO", "Usuario deshabilitado")

    ultima = get_latest_password_record(session, user_id)
    if ultima is None or ultima.debe_cambiar:
        raise APIError(
            403, "DEBE_CAMBIAR_CONTRASENA", "Debe actualizar su contraseña para continuar."
        )
    return user


def require_permission(
    session: Session,
    token: str | None,
    required_permission: str,
) -> AuthSessionResponse:
    current_session = get_current_authenticated_session(session, token)
    if not has_permission(current_session.permisos, required_permission):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return current_session


def require_any_permission(
    session: Session,
    token: str | None,
    *required_permissions: str,
) -> AuthSessionResponse:
    current_session = get_current_authenticated_session(session, token)
    if not any(
        has_permission(current_session.permisos, permission)
        for permission in required_permissions
    ):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return current_session
