from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.recordatorios import (
    RecordatorioCreate,
    RecordatorioEnviado,
    RecordatoriosResponse,
)
from app.services.authorization_service import require_permission
from app.services.recordatorio_service import listar_pendientes, registrar_envio

router = APIRouter(prefix="/api/recordatorios", tags=["recordatorios"])


@router.get("/pendientes", response_model=RecordatoriosResponse)
def get_pendientes(
    fecha_turnos: date | None = Query(default=None),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RecordatoriosResponse:
    require_permission(session, access_token, "recordatorios:enviar")
    return listar_pendientes(session, fecha_turnos)


@router.post("", response_model=RecordatorioEnviado, status_code=status.HTTP_201_CREATED)
def post_recordatorio(
    body: RecordatorioCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> RecordatorioEnviado:
    sesion = require_permission(session, access_token, "recordatorios:enviar")
    return registrar_envio(session, body, sesion.usuario.id)
