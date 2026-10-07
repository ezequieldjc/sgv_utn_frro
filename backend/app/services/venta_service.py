from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.models.auth.usuario import Usuario
from app.models.comercial.detalle_venta import DetalleVenta
from app.models.comercial.venta import Venta
from app.models.core.persona import Persona
from app.models.stock.producto import Producto
from app.schemas.ventas import (
    ClienteOpcion,
    DetalleVentaItem,
    VentaCreate,
    VentaDetail,
    VentaListItem,
    VentaListResponse,
    VentaResultado,
)
from app.services.stock_service import aplicar_movimiento, get_producto_model


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _nombre_cliente(persona: Persona | None) -> str | None:
    return f"{persona.nombre} {persona.apellido}" if persona else None


def registrar_venta(session: Session, payload: VentaCreate, usuario_id: int) -> VentaResultado:
    """Venta de mostrador: envases completos, precio tomado del producto.
    Crea la venta, sus líneas y un movimiento `venta` por producto en una sola transacción."""
    if payload.persona_id is not None and session.get(Persona, payload.persona_id) is None:
        raise APIError(404, "CLIENTE_NO_ENCONTRADO", "No se encontró el cliente indicado")

    # Si el mismo producto viene en dos líneas, se suman.
    cantidades: OrderedDict[int, int] = OrderedDict()
    for item in payload.items:
        cantidades[item.producto_id] = cantidades.get(item.producto_id, 0) + item.cantidad

    productos: list[tuple[Producto, int]] = []
    for producto_id, cantidad in cantidades.items():
        producto = get_producto_model(session, producto_id, bloquear=True)
        if not producto.activo:
            raise APIError(400, "PRODUCTO_INACTIVO", f"'{producto.nombre}' está dado de baja")
        if producto.precio_venta is None:
            raise APIError(
                400, "PRODUCTO_NO_VENDIBLE", f"'{producto.nombre}' no está habilitado para la venta"
            )
        productos.append((producto, cantidad))

    total = sum(
        (Decimal(p.precio_venta) * cantidad for p, cantidad in productos), Decimal("0")
    ).quantize(Decimal("0.01"))
    venta = Venta(
        persona_id=payload.persona_id,
        usuario_id=usuario_id,
        total=total,
        medio_pago=payload.medio_pago,
    )
    session.add(venta)
    session.flush()

    advertencias: list[str] = []
    for producto, cantidad in productos:
        session.add(
            DetalleVenta(
                venta_id=venta.id or 0,
                producto_id=producto.id or 0,
                cantidad=cantidad,
                precio_unitario=producto.precio_venta,
            )
        )
        _, avisos = aplicar_movimiento(
            session,
            producto,
            tipo="venta",
            delta_cerrados=-cantidad,
            delta_abierta=Decimal("0"),
            usuario_id=usuario_id,
            venta_id=venta.id,
        )
        advertencias.extend(avisos)
    session.commit()
    return VentaResultado(venta=get_venta(session, venta.id or 0), advertencias=advertencias)


def get_venta(session: Session, venta_id: int) -> VentaDetail:
    venta = session.get(Venta, venta_id)
    if venta is None:
        raise APIError(404, "VENTA_NO_ENCONTRADA", "No se encontró la venta indicada")
    usuario = session.get(Usuario, venta.usuario_id)
    persona = session.get(Persona, venta.persona_id) if venta.persona_id else None
    lineas = session.exec(
        select(DetalleVenta, Producto.nombre)
        .join(Producto, Producto.id == DetalleVenta.producto_id)
        .where(DetalleVenta.venta_id == venta_id)
        .order_by(DetalleVenta.id)
    ).all()
    return VentaDetail(
        id=venta.id or 0,
        fecha=_as_utc(venta.fecha),
        total=venta.total,
        medio_pago=venta.medio_pago,
        persona_id=venta.persona_id,
        cliente_nombre=_nombre_cliente(persona),
        usuario_id=venta.usuario_id,
        usuario_username=usuario.username if usuario else "",
        items=[
            DetalleVentaItem(
                producto_id=d.producto_id,
                producto_nombre=nombre,
                cantidad=d.cantidad,
                precio_unitario=d.precio_unitario,
                subtotal=(Decimal(d.precio_unitario) * d.cantidad).quantize(Decimal("0.01")),
            )
            for d, nombre in lineas
        ],
    )


def list_ventas(
    session: Session,
    *,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> VentaListResponse:
    filtros = []
    if desde is not None:
        filtros.append(Venta.fecha >= _as_utc(desde))
    if hasta is not None:
        filtros.append(Venta.fecha < _as_utc(hasta))
    page = max(page, 1)
    page_size = max(min(page_size, 200), 1)
    total = session.exec(select(func.count()).select_from(Venta).where(*filtros)).one()
    items_por_venta = (
        select(DetalleVenta.venta_id, func.count().label("n"))
        .group_by(DetalleVenta.venta_id)
        .subquery()
    )
    rows = session.exec(
        select(Venta, Usuario.username, Persona, items_por_venta.c.n)
        .join(Usuario, Usuario.id == Venta.usuario_id)
        .outerjoin(Persona, Persona.id == Venta.persona_id)
        .outerjoin(items_por_venta, items_por_venta.c.venta_id == Venta.id)
        .where(*filtros)
        .order_by(col(Venta.fecha).desc(), col(Venta.id).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return VentaListResponse(
        items=[
            VentaListItem(
                id=v.id or 0,
                fecha=_as_utc(v.fecha),
                total=v.total,
                medio_pago=v.medio_pago,
                cliente_nombre=_nombre_cliente(persona),
                usuario_username=username,
                cantidad_items=int(n or 0),
            )
            for v, username, persona, n in rows
        ],
        total=int(total),
        page=page,
        page_size=page_size,
    )


def buscar_clientes(session: Session, q: str, *, limit: int = 20) -> list[ClienteOpcion]:
    term = q.strip()
    if len(term) < 2:
        return []
    like = f"%{term}%"
    rows = session.exec(
        select(Persona)
        .where(
            Persona.es_cliente.is_(True),
            or_(
                col(Persona.nombre).ilike(like),
                col(Persona.apellido).ilike(like),
                col(Persona.dni).ilike(like),
            ),
        )
        .order_by(Persona.apellido, Persona.nombre)
        .limit(limit)
    ).all()
    return [ClienteOpcion(id=p.id or 0, nombre=p.nombre, apellido=p.apellido, dni=p.dni) for p in rows]
