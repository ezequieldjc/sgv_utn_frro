from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlmodel import Session

from app.core.errors import APIError
from app.core.settings import get_settings
from app.db.session import get_session
from app.schemas.auth import AuthSessionResponse, LoginRequest
from app.services.auth_service import build_session_response, create_login_audit, validate_login
from app.services.authorization_service import get_current_authenticated_session
from app.services.config_service import get_access_token_expiration_minutes, get_refresh_token_expiration_minutes
from app.services.token_service import issue_token_pair

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _extract_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "0.0.0.0"


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, request: Request, response: Response, session: Session = Depends(get_session)) -> AuthSessionResponse:
    validation = validate_login(session, payload.username, payload.password)
    client_ip = _extract_client_ip(request)

    if not validation.success or validation.user is None:
        create_login_audit(
            session,
            username_ingresado=payload.username,
            ip=client_ip,
            success=False,
            user_id=validation.user.id if validation.user else None,
            failure_reason=validation.failure_reason,
        )
        if validation.failure_reason == "USUARIO_DESHABILITADO":
            raise APIError(403, "USUARIO_DESHABILITADO", "Usuario deshabilitado")
        raise APIError(401, "CREDENCIALES_INVALIDAS", "Credenciales incorrectas")

    session_response = build_session_response(session, validation.user)
    token_pair = issue_token_pair(
        user_id=validation.user.id or 0,
        rol_id=validation.user.rol_id,
        permisos=session_response.permisos,
        version_token=validation.user.version_token,
        access_minutes=get_access_token_expiration_minutes(),
        refresh_minutes=get_refresh_token_expiration_minutes(),
    )

    create_login_audit(
        session,
        username_ingresado=payload.username,
        ip=client_ip,
        success=True,
        user_id=validation.user.id,
    )

    settings = get_settings()
    response.set_cookie(
        key=settings.access_cookie_name,
        value=token_pair.access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=token_pair.refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return session_response


@router.get("/me", response_model=AuthSessionResponse)
def me(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> AuthSessionResponse:
    return get_current_authenticated_session(session, access_token)


@router.post("/logout", status_code=204)
def logout(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(key=settings.access_cookie_name, path="/")
    response.delete_cookie(key=settings.refresh_cookie_name, path="/")
    response.status_code = 204
