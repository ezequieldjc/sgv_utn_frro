"""Portal del cliente (solo lectura). Reglas de seguridad en services/portal_service.py."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.portal import (
    PortalCompraDetalle,
    PortalCompraItem,
    PortalConsultaDetalle,
    PortalConsultaItem,
    PortalDisponibilidad,
    PortalMascota,
    PortalTurno,
    PortalTurnoCreate,
    PortalTurnoOpciones,
    PortalTurnosResponse,
)
from app.services import portal_service
from app.services.authorization_service import require_permission

router = APIRouter(prefix="/api/portal", tags=["portal"])

PERMISO_PORTAL = "portal:ver"
PERMISO_PEDIR_TURNO = "portal:pedir_turno"


def _persona(
    session: Session, access_token: str | None, permiso: str = PERMISO_PORTAL
) -> int | None:
    """Valida el permiso y devuelve la persona de la sesión. Nunca se toma de la URL."""
    sesion = require_permission(session, access_token, permiso)
    return portal_service.persona_de_sesion(session, sesion.usuario.id)


@router.get("/mascotas", response_model=list[PortalMascota])
def get_mis_mascotas(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[PortalMascota]:
    return portal_service.listar_mascotas(session, _persona(session, access_token))


@router.get("/mascotas/{mascota_id}", response_model=PortalMascota)
def get_mi_mascota(
    mascota_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalMascota:
    return portal_service.get_mascota(session, _persona(session, access_token), mascota_id)


@router.get("/mascotas/{mascota_id}/consultas", response_model=list[PortalConsultaItem])
def get_consultas_de_mi_mascota(
    mascota_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[PortalConsultaItem]:
    return portal_service.listar_consultas(session, _persona(session, access_token), mascota_id)


@router.get("/consultas/{consulta_id}", response_model=PortalConsultaDetalle)
def get_mi_consulta(
    consulta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalConsultaDetalle:
    return portal_service.get_consulta(session, _persona(session, access_token), consulta_id)


@router.get("/turnos", response_model=PortalTurnosResponse)
def get_mis_turnos(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalTurnosResponse:
    return portal_service.listar_turnos(session, _persona(session, access_token))


@router.get("/compras", response_model=list[PortalCompraItem])
def get_mis_compras(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[PortalCompraItem]:
    return portal_service.listar_compras(session, _persona(session, access_token))


@router.get("/compras/{venta_id}", response_model=PortalCompraDetalle)
def get_mi_compra(
    venta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalCompraDetalle:
    return portal_service.get_compra(session, _persona(session, access_token), venta_id)


# ---------------------------------------------------------------------------
# Pedir y cancelar turnos (portal:pedir_turno)
# ---------------------------------------------------------------------------


@router.get("/turnos/opciones", response_model=PortalTurnoOpciones)
def get_opciones_turno(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalTurnoOpciones:
    persona = _persona(session, access_token, PERMISO_PEDIR_TURNO)
    return portal_service.opciones_turno(session, persona)


@router.get("/turnos/disponibilidad", response_model=PortalDisponibilidad)
def get_disponibilidad(
    mascota_id: int = Query(...),
    veterinario_id: int = Query(...),
    tipo_turno_id: int = Query(...),
    fecha: date = Query(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalDisponibilidad:
    persona = _persona(session, access_token, PERMISO_PEDIR_TURNO)
    return portal_service.disponibilidad(
        session,
        persona,
        mascota_id=mascota_id,
        veterinario_id=veterinario_id,
        tipo_turno_id=tipo_turno_id,
        fecha=fecha,
    )


@router.post("/turnos", response_model=PortalTurno, status_code=status.HTTP_201_CREATED)
def post_turno(
    body: PortalTurnoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalTurno:
    persona = _persona(session, access_token, PERMISO_PEDIR_TURNO)
    return portal_service.pedir_turno(session, persona, body)


@router.post("/turnos/{turno_id}/cancelar", response_model=PortalTurno)
def post_cancelar_turno(
    turno_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> PortalTurno:
    persona = _persona(session, access_token, PERMISO_PEDIR_TURNO)
    return portal_service.cancelar_turno(session, persona, turno_id)
