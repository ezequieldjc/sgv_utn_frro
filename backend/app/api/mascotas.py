from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.core.errors import APIError
from app.db.session import get_session
from app.models.catalogo.estado_reproductivo import EstadoReproductivo
from app.models.catalogo.habitat import Habitat
from app.models.catalogo.pelaje import Pelaje
from app.models.catalogo.tamanio import Tamanio
from app.models.catalogo.temperamento import Temperamento
from app.schemas.mascotas import (
    CatalogoClinicoOpcion,
    EspecieOpcionMascota,
    MascotaCreate,
    MascotaCreateResponse,
    MascotaDetail,
    MascotaEstadoOpcion,
    MascotaListResponse,
    MascotaUpdate,
    RazaOpcionMascota,
    TutorOpcion,
)
from app.services.authorization_service import require_any_permission, require_permission
from app.services.mascota_service import (
    buscar_tutores,
    create_mascota,
    get_mascota,
    get_raza_default_nombre,
    get_tutor_by_id,
    list_catalogo_clinico_por_especie,
    list_especies_activas,
    list_mascota_estados,
    list_mascotas,
    list_razas_por_especie,
    update_mascota,
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
    require_any_permission(
        session, access_token, "mascotas:ver_listado", "mascotas:crear", "mascotas:editar"
    )
    return list_especies_activas(session)


@router.get("/razas", response_model=list[RazaOpcionMascota])
def get_razas(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[RazaOpcionMascota]:
    require_any_permission(
        session, access_token, "mascotas:ver_listado", "mascotas:crear", "mascotas:editar"
    )
    return list_razas_por_especie(session, especie_id)


@router.get("/estados", response_model=list[MascotaEstadoOpcion])
def get_estados(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[MascotaEstadoOpcion]:
    require_any_permission(
        session, access_token, "mascotas:ver_listado", "mascotas:crear", "mascotas:editar"
    )
    return list_mascota_estados(session)


@router.get("/tutores", response_model=list[TutorOpcion])
def get_tutores(
    q: str = Query(default=""),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[TutorOpcion]:
    require_any_permission(session, access_token, "mascotas:crear", "mascotas:editar")
    return buscar_tutores(session, q)


@router.get("/tutores/{persona_id}", response_model=TutorOpcion)
def get_tutor(
    persona_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TutorOpcion:
    require_any_permission(session, access_token, "mascotas:crear", "mascotas:editar")
    tutor = get_tutor_by_id(session, persona_id)
    if tutor is None:
        raise APIError(404, "TUTOR_NO_ENCONTRADO", "No se encontró el tutor indicado")
    return tutor


@router.get("/config/raza-default")
def get_raza_default(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    require_any_permission(session, access_token, "mascotas:crear", "mascotas:editar")
    return {"nombre": get_raza_default_nombre(session)}


@router.get("/catalogos/pelajes", response_model=list[CatalogoClinicoOpcion])
def get_pelajes(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[CatalogoClinicoOpcion]:
    require_permission(session, access_token, "mascotas:editar")
    return list_catalogo_clinico_por_especie(session, model=Pelaje, especie_id=especie_id)


@router.get("/catalogos/tamanios", response_model=list[CatalogoClinicoOpcion])
def get_tamanios(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[CatalogoClinicoOpcion]:
    require_permission(session, access_token, "mascotas:editar")
    return list_catalogo_clinico_por_especie(session, model=Tamanio, especie_id=especie_id)


@router.get("/catalogos/habitats", response_model=list[CatalogoClinicoOpcion])
def get_habitats(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[CatalogoClinicoOpcion]:
    require_permission(session, access_token, "mascotas:editar")
    return list_catalogo_clinico_por_especie(session, model=Habitat, especie_id=especie_id)


@router.get("/catalogos/estados-reproductivos", response_model=list[CatalogoClinicoOpcion])
def get_estados_reproductivos(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[CatalogoClinicoOpcion]:
    require_permission(session, access_token, "mascotas:editar")
    return list_catalogo_clinico_por_especie(
        session, model=EstadoReproductivo, especie_id=especie_id
    )


@router.get("/catalogos/temperamentos", response_model=list[CatalogoClinicoOpcion])
def get_temperamentos(
    especie_id: int = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[CatalogoClinicoOpcion]:
    require_permission(session, access_token, "mascotas:editar")
    return list_catalogo_clinico_por_especie(
        session, model=Temperamento, especie_id=especie_id
    )


@router.get("/{mascota_id}", response_model=MascotaDetail)
def get_mascota_by_id(
    mascota_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MascotaDetail:
    require_permission(session, access_token, "mascotas:editar")
    return get_mascota(session, mascota_id)


@router.patch("/{mascota_id}", response_model=MascotaDetail)
def patch_mascota(
    mascota_id: int,
    body: MascotaUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MascotaDetail:
    require_permission(session, access_token, "mascotas:editar")
    return update_mascota(session, mascota_id, body)
