from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.core.errors import APIError
from app.core.security import hash_password, verify_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.login import Login
from app.models.auth.usuario import Usuario
from app.schemas.auth import (
    AuthSessionResponse,
    CambiarContrasenaObligatorioRequest,
    CambiarContrasenaObligatorioResponse,
    UsuarioSesion,
)
from app.services.permission_service import get_user_permissions


@dataclass(slots=True)
class LoginValidationResult:
    success: bool
    user: Usuario | None
    failure_reason: str | None


def get_user_by_username(session: Session, username: str) -> Usuario | None:
    stmt = (
        select(Usuario)
        .where(Usuario.username == username)
        .options(selectinload(Usuario.persona))
        .options(selectinload(Usuario.rol))
    )
    return session.exec(stmt).first()


def get_latest_password_record(session: Session, user_id: int) -> HistorialContrasena | None:
    stmt = (
        select(HistorialContrasena)
        .where(HistorialContrasena.usuario_id == user_id)
        .order_by(HistorialContrasena.fecha_creacion.desc(), HistorialContrasena.id.desc())
    )
    return session.exec(stmt).first()


def validate_login(session: Session, username: str, password: str) -> LoginValidationResult:
    user = get_user_by_username(session, username)
    if user is None:
        return LoginValidationResult(success=False, user=None, failure_reason="USUARIO_INEXISTENTE")

    if not user.habilitado:
        return LoginValidationResult(success=False, user=user, failure_reason="USUARIO_DESHABILITADO")

    latest_password = get_latest_password_record(session, user.id or 0)
    if latest_password is None:
        return LoginValidationResult(success=False, user=user, failure_reason="SIN_HISTORIAL_CONTRASENA")

    if not verify_password(password, latest_password.hashed_password):
        return LoginValidationResult(success=False, user=user, failure_reason="CLAVE_INCORRECTA")

    if latest_password.debe_cambiar:
        return LoginValidationResult(
            success=False,
            user=user,
            failure_reason="DEBE_CAMBIAR_CONTRASENA",
        )

    return LoginValidationResult(success=True, user=user, failure_reason=None)


def create_login_audit(
    session: Session,
    *,
    username_ingresado: str,
    ip: str,
    success: bool,
    user_id: int | None = None,
    failure_reason: str | None = None,
) -> Login:
    login = Login(
        usuario_id=user_id,
        username_ingresado=username_ingresado,
        fecha=datetime.utcnow(),
        exito=success,
        ip=ip,
        razon_fallo=failure_reason,
    )
    session.add(login)
    session.commit()
    session.refresh(login)
    return login


def cambiar_contrasena_obligatorio(
    session: Session,
    payload: CambiarContrasenaObligatorioRequest,
) -> CambiarContrasenaObligatorioResponse:
    user = get_user_by_username(session, payload.username)
    if user is None:
        raise APIError(401, "CREDENCIALES_INVALIDAS", "Credenciales incorrectas")

    if not user.habilitado:
        raise APIError(403, "USUARIO_DESHABILITADO", "Usuario deshabilitado")

    latest_password = get_latest_password_record(session, user.id or 0)
    if latest_password is None or not verify_password(
        payload.password_actual, latest_password.hashed_password
    ):
        raise APIError(401, "CREDENCIALES_INVALIDAS", "Credenciales incorrectas")

    if not latest_password.debe_cambiar:
        raise APIError(
            400,
            "CAMBIO_NO_REQUERIDO",
            "El usuario no necesita cambiar su contraseña",
        )

    historial = HistorialContrasena(
        usuario_id=user.id or 0,
        hashed_password=hash_password(payload.password_nueva),
        debe_cambiar=False,
    )
    user.version_token += 1
    session.add(historial)
    session.add(user)
    session.commit()

    return CambiarContrasenaObligatorioResponse(
        mensaje="Contraseña actualizada correctamente. Por favor, inicia sesión con tus nuevas credenciales."
    )


def build_session_response(session: Session, user: Usuario) -> AuthSessionResponse:
    if user.persona is None:
        raise APIError(500, "PERSONA_NO_CARGADA", "No se pudo cargar la persona asociada al usuario")

    permissions = get_user_permissions(session, user)
    return AuthSessionResponse(
        usuario=UsuarioSesion(
            id=user.id or 0,
            username=user.username,
            nombre=user.persona.nombre,
            apellido=user.persona.apellido,
        ),
        permisos=permissions,
    )

