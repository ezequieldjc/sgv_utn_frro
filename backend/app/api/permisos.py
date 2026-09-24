from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends
from sqlmodel import Session

from app.core.errors import APIError
from app.db.session import get_session
from app.schemas.roles import PermisoItem
from app.services.authorization_service import get_current_authenticated_session
from app.services.permission_service import has_permission
from app.services.rol_service import list_permisos

router = APIRouter(prefix="/api/permisos", tags=["permisos"])


@router.get("", response_model=list[PermisoItem])
def get_permisos(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[PermisoItem]:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "roles:ver"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return list_permisos(session)
