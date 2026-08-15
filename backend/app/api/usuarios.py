from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.usuarios import (
    UsuarioCreate,
    UsuarioCreateResponse,
    UsuarioHabilitadoUpdate,
    UsuarioListItem,
)
from app.services.authorization_service import require_permission
from app.services.usuario_service import create_usuario, list_usuarios, set_usuario_habilitado

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


@router.patch("/{usuario_id}/habilitado", response_model=UsuarioListItem)
def patch_usuario_habilitado(
    usuario_id: int,
    body: UsuarioHabilitadoUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> UsuarioListItem:
    require_permission(session, access_token, "usuarios:editar")
    return set_usuario_habilitado(session, usuario_id, body.habilitado)
