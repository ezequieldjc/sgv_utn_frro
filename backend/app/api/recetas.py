from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Query
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.recetas import RecetaListResponse
from app.services.authorization_service import require_any_permission
from app.services.receta_service import listar_recetas

router = APIRouter(prefix="/api/recetas", tags=["recetas"])

PERMISOS_HISTORIAL_RECETAS = (
    "recetas:ver_historial",
    "recetas:crear",
    "consultas:ver_historial",
    "consultas:ver_historia_clinica",
)


@router.get("", response_model=RecetaListResponse)
def get_recetas(
    mascota_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RecetaListResponse:
    require_any_permission(session, access_token, *PERMISOS_HISTORIAL_RECETAS)
    return listar_recetas(session, mascota_id=mascota_id, page=page, page_size=page_size)
