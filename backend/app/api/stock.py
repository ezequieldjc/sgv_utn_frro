from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Body, Cookie, Depends, Query, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.stock import (
    AnalisisResponse,
    MovimientoCreate,
    MovimientoListResponse,
    MovimientoResultado,
    ProductoCreate,
    ProductoItem,
    ProductoListResponse,
    ProductoUpdate,
    RubroOpcion,
    TipoMovimiento,
)
from app.services.authorization_service import require_any_permission, require_permission
from app.services.stock_service import (
    create_producto,
    get_analisis,
    get_producto,
    list_movimientos,
    list_productos,
    list_rubros_activos,
    registrar_movimiento,
    update_producto,
)

router = APIRouter(prefix="/api/stock", tags=["stock"])

PERMISOS_STOCK = (
    "stock:crear_insumo",
    "stock:editar_insumo",
    "stock:registrar_movimiento",
    "stock:ver_movimientos",
    "stock:ver_analisis",
)


@router.get("/productos", response_model=ProductoListResponse)
def get_productos(
    q: str | None = Query(default=None),
    rubro_id: int | None = Query(default=None),
    activo: bool | None = Query(default=True),
    con_alerta: bool = Query(default=False),
    para_venta: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ProductoListResponse:
    require_any_permission(session, access_token, *PERMISOS_STOCK, "ventas:registrar")
    return list_productos(
        session,
        q=q,
        rubro_id=rubro_id,
        activo=activo,
        con_alerta=con_alerta,
        para_venta=para_venta,
        page=page,
        page_size=page_size,
    )


@router.post("/productos", response_model=ProductoItem, status_code=status.HTTP_201_CREATED)
def post_producto(
    body: ProductoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ProductoItem:
    sesion = require_permission(session, access_token, "stock:crear_insumo")
    return create_producto(session, body, sesion.usuario.id)


@router.get("/productos/{producto_id}", response_model=ProductoItem)
def get_producto_por_id(
    producto_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ProductoItem:
    require_any_permission(session, access_token, *PERMISOS_STOCK, "ventas:registrar")
    return get_producto(session, producto_id)


@router.patch("/productos/{producto_id}", response_model=ProductoItem)
def patch_producto(
    producto_id: int,
    body: ProductoUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ProductoItem:
    require_permission(session, access_token, "stock:editar_insumo")
    return update_producto(session, producto_id, body)


@router.get("/rubros", response_model=list[RubroOpcion])
def get_rubros(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[RubroOpcion]:
    require_any_permission(session, access_token, *PERMISOS_STOCK)
    return list_rubros_activos(session)


@router.post("/movimientos", response_model=MovimientoResultado, status_code=status.HTTP_201_CREATED)
def post_movimiento(
    body: MovimientoCreate = Body(...),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MovimientoResultado:
    sesion = require_permission(session, access_token, "stock:registrar_movimiento")
    return registrar_movimiento(session, body, sesion.usuario.id)


@router.get("/movimientos", response_model=MovimientoListResponse)
def get_movimientos(
    producto_id: int | None = Query(default=None),
    tipo: TipoMovimiento | None = Query(default=None),
    desde: datetime | None = Query(default=None),
    hasta: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> MovimientoListResponse:
    require_permission(session, access_token, "stock:ver_movimientos")
    return list_movimientos(
        session,
        producto_id=producto_id,
        tipo=tipo,
        desde=desde,
        hasta=hasta,
        page=page,
        page_size=page_size,
    )


@router.get("/analisis", response_model=AnalisisResponse)
def get_analisis_endpoint(
    desde: datetime | None = Query(default=None),
    hasta: datetime | None = Query(default=None),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> AnalisisResponse:
    require_permission(session, access_token, "stock:ver_analisis")
    return get_analisis(session, desde=desde, hasta=hasta)
