from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends
from sqlmodel import Session

from app.db.session import get_session
from app.core.errors import APIError
from app.schemas.roles import RolListItem
from app.services.authorization_service import get_current_authenticated_session
from app.services.permission_service import has_permission
from app.services.rol_service import list_roles

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
    ):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return list_roles(session)
