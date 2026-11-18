from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.vacunas import (
    ProductoPreventivoOpcion,
    TratamientoPreventivoCreate,
    TratamientoPreventivoResultado,
    VacunasMascotaResponse,
)
from app.services.authorization_service import require_any_permission, require_permission
from app.services.vacuna_service import listar_vacunas, productos_preventivos, registrar_tratamiento

router = APIRouter(prefix="/api/vacunas", tags=["vacunas"])

# Quien registra también ve; el veterinario que atiende la consulta también ve el carnet.
PERMISOS_LECTURA = (
    "vacunas:ver",
    "vacunas:registrar",
    "consultas:crear",
    "consultas:ver_historia_clinica",
)


@router.get("", response_model=VacunasMascotaResponse)
def get_vacunas_mascota(
    mascota_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> VacunasMascotaResponse:
    require_any_permission(session, access_token, *PERMISOS_LECTURA)
    return listar_vacunas(session, mascota_id)


@router.get("/productos", response_model=list[ProductoPreventivoOpcion])
def get_productos_preventivos(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[ProductoPreventivoOpcion]:
    require_permission(session, access_token, "vacunas:registrar")
    return productos_preventivos(session)


@router.post(
    "", response_model=TratamientoPreventivoResultado, status_code=status.HTTP_201_CREATED
)
def post_vacuna(
    body: TratamientoPreventivoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TratamientoPreventivoResultado:
    sesion = require_permission(session, access_token, "vacunas:registrar")
    return registrar_tratamiento(session, body, sesion.usuario.id)
