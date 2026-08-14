from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.usuarios import UsuarioListItem
from app.services.authorization_service import require_permission
from app.services.usuario_service import list_usuarios

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


@router.get("", response_model=list[UsuarioListItem])
def get_usuarios(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[UsuarioListItem]:
    require_permission(session, access_token, "usuarios:ver")
    return list_usuarios(session)
