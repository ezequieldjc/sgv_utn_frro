from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.agenda import (
    DisponibilidadResponse,
    HorarioAtencion,
    MascotaAgendaOpcion,
    TipoTurnoOpcion,
    TurnoCambioEstado,
    TurnoCreate,
    TurnoItem,
    TurnoListResponse,
    TurnoReprogramar,
    VeterinarioOpcion,
)
from app.services.authorization_service import require_any_permission, require_permission
from app.services.turno_service import (
    buscar_mascotas,
    cambiar_estado_turno,
    cancelar_turno,
    create_turno,
    get_disponibilidad,
    get_horario_atencion,
    get_turno,
    list_tipos_turno_activos,
    list_turnos,
    list_veterinarios,
    reprogramar_turno,
)

router = APIRouter(prefix="/api/agenda", tags=["agenda"])

PERMISOS_AGENDA = (
    "agenda:ver",
    "agenda:crear_turno",
    "agenda:editar_turno",
    "agenda:cancelar_turno",
)
PERMISOS_FORMULARIO = ("agenda:crear_turno", "agenda:editar_turno")


@router.get("/turnos", response_model=TurnoListResponse)
def get_turnos(
    desde: datetime = Query(...),
    hasta: datetime = Query(...),
    veterinario_id: int | None = Query(default=None),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoListResponse:
    require_permission(session, access_token, "agenda:ver")
    return list_turnos(session, desde=desde, hasta=hasta, veterinario_id=veterinario_id)


@router.post("/turnos", response_model=TurnoItem, status_code=status.HTTP_201_CREATED)
def post_turno(
    body: TurnoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoItem:
    require_permission(session, access_token, "agenda:crear_turno")
    return create_turno(session, body)


@router.get("/turnos/{turno_id}", response_model=TurnoItem)
def get_turno_por_id(
    turno_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoItem:
    require_permission(session, access_token, "agenda:ver")
    return get_turno(session, turno_id)


@router.patch("/turnos/{turno_id}", response_model=TurnoItem)
def patch_turno(
    turno_id: int,
    body: TurnoReprogramar,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoItem:
    require_permission(session, access_token, "agenda:editar_turno")
    return reprogramar_turno(session, turno_id, body)


@router.post("/turnos/{turno_id}/estado", response_model=TurnoItem)
def post_turno_estado(
    turno_id: int,
    body: TurnoCambioEstado,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoItem:
    require_permission(session, access_token, "agenda:editar_turno")
    return cambiar_estado_turno(session, turno_id, body)


@router.post("/turnos/{turno_id}/cancelar", response_model=TurnoItem)
def post_turno_cancelar(
    turno_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> TurnoItem:
    require_permission(session, access_token, "agenda:cancelar_turno")
    return cancelar_turno(session, turno_id)


@router.get("/veterinarios", response_model=list[VeterinarioOpcion])
def get_veterinarios(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[VeterinarioOpcion]:
    require_any_permission(session, access_token, *PERMISOS_AGENDA)
    return list_veterinarios(session)


@router.get("/tipos-turno", response_model=list[TipoTurnoOpcion])
def get_tipos_turno(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[TipoTurnoOpcion]:
    require_any_permission(session, access_token, *PERMISOS_AGENDA)
    return list_tipos_turno_activos(session)


@router.get("/mascotas", response_model=list[MascotaAgendaOpcion])
def get_mascotas_agenda(
    q: str = Query(default=""),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[MascotaAgendaOpcion]:
    require_any_permission(session, access_token, *PERMISOS_FORMULARIO)
    return buscar_mascotas(session, q)


@router.get("/disponibilidad", response_model=DisponibilidadResponse)
def get_disponibilidad_endpoint(
    veterinario_id: int = Query(...),
    fecha: date = Query(...),
    tipo_turno_id: int = Query(...),
    mascota_id: int | None = Query(default=None),
    excluir_turno_id: int | None = Query(default=None),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> DisponibilidadResponse:
    require_any_permission(session, access_token, *PERMISOS_FORMULARIO)
    return get_disponibilidad(
        session,
        veterinario_id=veterinario_id,
        fecha=fecha,
        tipo_turno_id=tipo_turno_id,
        mascota_id=mascota_id,
        excluir_turno_id=excluir_turno_id,
    )


@router.get("/horario", response_model=HorarioAtencion)
def get_horario(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> HorarioAtencion:
    require_any_permission(session, access_token, *PERMISOS_AGENDA)
    return get_horario_atencion()
