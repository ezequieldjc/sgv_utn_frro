from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

MedioPago = Literal["efectivo", "debito", "credito", "transferencia"]


class VentaItemIn(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)  # envases completos


class VentaCreate(BaseModel):
    """El precio lo toma el backend del producto; la pantalla no lo envía."""

    items: list[VentaItemIn] = Field(min_length=1)
    medio_pago: MedioPago
    persona_id: int | None = None


class DetalleVentaItem(BaseModel):
    producto_id: int
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class VentaDetail(BaseModel):
    id: int
    fecha: datetime
    total: Decimal
    medio_pago: MedioPago
    persona_id: int | None = None
    cliente_nombre: str | None = None
    usuario_id: int
    usuario_username: str
    items: list[DetalleVentaItem]


class VentaResultado(BaseModel):
    venta: VentaDetail
    advertencias: list[str]


class VentaListItem(BaseModel):
    id: int
    fecha: datetime
    total: Decimal
    medio_pago: MedioPago
    cliente_nombre: str | None = None
    usuario_username: str
    cantidad_items: int


class VentaListResponse(BaseModel):
    items: list[VentaListItem]
    total: int
    page: int
    page_size: int


class ClienteOpcion(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str | None = None
