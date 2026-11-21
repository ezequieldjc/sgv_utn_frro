from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.usuarios import (
    UsuarioCreate,
    UsuarioCreateResponse,
    UsuarioDetail,
    UsuarioHabilitadoUpdate,
    UsuarioListItem,
    UsuarioRestablecerResponse,
    UsuarioUpdate,
)
from app.services.authorization_service import require_permission
from app.services.usuario_service import (
    create_usuario,
    get_usuario_detail,
    list_usuarios,
    restablecer_contrasena,
    set_usuario_habilitado,
    update_usuario,
)

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioListItem])
def get_usuarios(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[UsuarioListItem]:
    require_permission(session, access_token, "usuarios:ver")
    return list_usuarios(session)


@router.post("", response_model=UsuarioCreateResponse, status_code=status.HTTP_201_CREATED)
def post_usuario(
    body: UsuarioCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioCreateResponse:
    require_permission(session, access_token, "usuarios:crear")
    return create_usuario(session, body)


@router.get("/{usuario_id}", response_model=UsuarioDetail)
def get_usuario(
    usuario_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioDetail:
    require_permission(session, access_token, "usuarios:ver")
    return get_usuario_detail(session, usuario_id)


@router.put("/{usuario_id}", response_model=UsuarioDetail)
def put_usuario(
    usuario_id: int,
    body: UsuarioUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioDetail:
    require_permission(session, access_token, "usuarios:editar")
    return update_usuario(session, usuario_id, body)


@router.patch("/{usuario_id}/habilitado", response_model=UsuarioListItem)
def patch_usuario_habilitado(
    usuario_id: int,
    body: UsuarioHabilitadoUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioListItem:
    require_permission(session, access_token, "usuarios:editar")
    return set_usuario_habilitado(session, usuario_id, body.habilitado)


@router.post(
    "/{usuario_id}/restablecer-contrasena",
    response_model=UsuarioRestablecerResponse,
)
def post_restablecer_contrasena(
    usuario_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioRestablecerResponse:
    require_permission(session, access_token, "usuarios:editar")
    return restablecer_contrasena(session, usuario_id)
