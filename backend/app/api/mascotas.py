from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.core.errors import APIError
from app.db.session import get_session
from app.schemas.mascotas import (
    EspecieOpcionMascota,
    MascotaCreate,
    MascotaCreateResponse,
    MascotaEstadoOpcion,
    MascotaListResponse,
    RazaOpcionMascota,
    TutorOpcion,
)
from app.services.authorization_service import require_permission
from app.services.mascota_service import (
    buscar_tutores,
    create_mascota,
    get_raza_default_nombre,
    get_tutor_by_id,
    list_especies_activas,
    list_mascota_estados,
    list_mascotas,
    list_razas_por_especie,
)

router = APIRouter(prefix="/api/mascotas", tags=["mascotas"])


@router.get("", response_model=MascotaListResponse)
def get_mascotas(
    q: str | None = Query(default=None),
    especie_id: int | None = Query(default=None),
    raza_id: int | None = Query(default=None),
    mascota_estado_id: int | None = Query(default=None),
    cliente_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MascotaListResponse:
    require_permission(session, access_token, "mascotas:ver_listado")
    return list_mascotas(
        session,
        q=q,
        especie_id=especie_id,
        raza_id=raza_id,
        mascota_estado_id=mascota_estado_id,
        cliente_id=cliente_id,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=MascotaCreateResponse, status_code=status.HTTP_201_CREATED)
def post_mascota(
    body: MascotaCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MascotaCreateResponse:
    require_permission(session, access_token, "mascotas:crear")
    return create_mascota(session, body)


@router.get("/especies", response_model=list[EspecieOpcionMascota])
def get_especies(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[EspecieOpcionMascota]:
    require_permission(session, access_token, "mascotas:ver_listado")
    return list_especies_activas(session)


@router.get("/razas", response_model=list[RazaOpcionMascota])
def get_razas(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[RazaOpcionMascota]:
    require_permission(session, access_token, "mascotas:ver_listado")
    return list_razas_por_especie(session, especie_id)


@router.get("/estados", response_model=list[MascotaEstadoOpcion])
def get_estados(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[MascotaEstadoOpcion]:
    require_permission(session, access_token, "mascotas:ver_listado")
    return list_mascota_estados(session)


@router.get("/tutores", response_model=list[TutorOpcion])
def get_tutores(
    q: str = Query(default=""),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[TutorOpcion]:
    require_permission(session, access_token, "mascotas:crear")
    return buscar_tutores(session, q)


@router.get("/tutores/{persona_id}", response_model=TutorOpcion)
def get_tutor(
    persona_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TutorOpcion:
    require_permission(session, access_token, "mascotas:crear")
    tutor = get_tutor_by_id(session, persona_id)
    if tutor is None:
        raise APIError(404, "TUTOR_NO_ENCONTRADO", "No se encontró el tutor indicado")
    return tutor


@router.get("/config/raza-default")
def get_raza_default(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    require_permission(session, access_token, "mascotas:crear")
    return {"nombre": get_raza_default_nombre(session)}
