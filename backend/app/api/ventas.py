from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.ventas import (
    ClienteOpcion,
    VentaCreate,
    VentaDetail,
    VentaListResponse,
    VentaResultado,
)
from app.services.authorization_service import require_permission
from app.services.venta_service import buscar_clientes, get_venta, list_ventas, registrar_venta

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


@router.post("", response_model=VentaResultado, status_code=status.HTTP_201_CREATED)
def post_venta(
    body: VentaCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> VentaResultado:
    sesion = require_permission(session, access_token, "ventas:registrar")
    return registrar_venta(session, body, sesion.usuario.id)


@router.get("", response_model=VentaListResponse)
def get_ventas(
    desde: datetime | None = Query(default=None),
    hasta: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> VentaListResponse:
    require_permission(session, access_token, "ventas:ver")
    return list_ventas(session, desde=desde, hasta=hasta, page=page, page_size=page_size)


@router.get("/clientes", response_model=list[ClienteOpcion])
def get_clientes(
    q: str = Query(default=""),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[ClienteOpcion]:
    require_permission(session, access_token, "ventas:registrar")
    return buscar_clientes(session, q)


@router.get("/{venta_id}", response_model=VentaDetail)
def get_venta_por_id(
    venta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> VentaDetail:
    require_permission(session, access_token, "ventas:ver")
    return get_venta(session, venta_id)
