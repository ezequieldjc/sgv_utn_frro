from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends
from sqlmodel import Session

from app.core.errors import APIError
from app.db.session import get_session
from app.schemas.roles import RolCreate, RolDetail, RolListItem, RolPermisosUpdate
from app.services.authorization_service import get_current_authenticated_session
from app.services.permission_service import has_permission
from app.services.rol_service import (
    create_rol,
    get_rol_detail,
    list_roles,
    update_rol_permisos,
)

router = APIRouter(prefix="/api/roles", tags=["roles"])


@router.get("", response_model=list[RolListItem])
def get_roles(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[RolListItem]:
    current = get_current_authenticated_session(session, access_token)
    if not (
        has_permission(current.permisos, "usuarios:crear")
        or has_permission(current.permisos, "usuarios:ver")
        or has_permission(current.permisos, "roles:ver")
    ):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return list_roles(session)


@router.get("/{rol_id}", response_model=RolDetail)
def get_rol(
    rol_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RolDetail:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "roles:ver"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return get_rol_detail(session, rol_id)


@router.post("", response_model=RolDetail, status_code=201)
def post_rol(
    payload: RolCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RolDetail:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "roles:crear"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return create_rol(session, payload)


@router.put("/{rol_id}/permisos", response_model=RolDetail)
def put_rol_permisos(
    rol_id: int,
    payload: RolPermisosUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RolDetail:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "roles:editar"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return update_rol_permisos(session, rol_id, payload)
