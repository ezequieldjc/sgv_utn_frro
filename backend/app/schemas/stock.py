from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field, field_validator, model_validator

Unidad = Literal["unidad", "ml", "comprimido", "g", "kg"]
TipoMovimiento = Literal["compra", "venta", "consumo_clinico", "vencimiento_rotura", "ajuste"]
Destino = Literal["petshop", "consultorio"]
AlertaProducto = Literal["REVISAR_STOCK", "BAJO_MINIMO"]

Cantidad = Annotated[Decimal, Field(max_digits=12, decimal_places=3)]
Precio = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


def _texto_opcional(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    return value.strip()


class RubroOpcion(BaseModel):
    id: int
    nombre: str


class ProductoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    rubro_id: int
    proveedor: str | None = Field(default=None, max_length=100)
    unidad: Unidad
    contenido_envase: Decimal = Field(gt=0, max_digits=10, decimal_places=3)
    fraccionable: bool = False
    stock_minimo: int = Field(default=0, ge=0)
    precio_costo: Precio | None = None
    precio_venta: Precio | None = None
    envases_iniciales: int = Field(default=0, ge=0)
    cantidad_abierta_inicial: Cantidad = Field(default=Decimal("0"), ge=0)

    @field_validator("nombre")
    @classmethod
    def nombre_strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("El nombre es obligatorio")
        return value

    @field_validator("proveedor")
    @classmethod
    def proveedor_strip(cls, value: str | None) -> str | None:
        return _texto_opcional(value)

    @model_validator(mode="after")
    def abierto_solo_si_fraccionable(self) -> ProductoCreate:
        if not self.fraccionable and self.cantidad_abierta_inicial > 0:
            raise ValueError("Solo un producto fraccionable puede tener cantidad abierta")
        return self


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    rubro_id: int | None = None
    proveedor: str | None = Field(default=None, max_length=100)
    unidad: Unidad | None = None
    contenido_envase: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=3)
    fraccionable: bool | None = None
    stock_minimo: int | None = Field(default=None, ge=0)
    precio_costo: Precio | None = None
    precio_venta: Precio | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def nombre_strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("El nombre no puede quedar vacío")
        return value

    @field_validator("proveedor")
    @classmethod
    def proveedor_strip(cls, value: str | None) -> str | None:
        return _texto_opcional(value)


class ProductoItem(BaseModel):
    id: int
    nombre: str
    rubro_id: int
    rubro_nombre: str
    proveedor: str | None = None
    unidad: Unidad
    contenido_envase: Decimal
    fraccionable: bool
    envases_cerrados: int
    cantidad_abierta: Decimal
    stock_equivalente_envases: Decimal
    stock_minimo: int
    precio_costo: Decimal | None = None
    precio_venta: Decimal | None = None
    se_vende: bool
    activo: bool
    requiere_revision: bool
    alertas: list[AlertaProducto]


class ProductoListResponse(BaseModel):
    items: list[ProductoItem]
    total: int
    page: int
    page_size: int


# --- Movimientos (uno por tipo; la venta se registra desde /api/ventas) ---


class _MovimientoBase(BaseModel):
    producto_id: int
    observaciones: str | None = Field(default=None, max_length=255)

    @field_validator("observaciones")
    @classmethod
    def observaciones_strip(cls, value: str | None) -> str | None:
        return _texto_opcional(value)


class CompraIn(_MovimientoBase):
    tipo: Literal["compra"]
    envases: int = Field(gt=0)
    fecha_vencimiento: date | None = None


class ConsumoClinicoIn(_MovimientoBase):
    """`cantidad` en la unidad del producto si es fraccionable; en envases si no lo es.
    `envases_abiertos_nuevos`: cuántos envases cerrados se abrieron para este consumo
    (0 = se usó un envase ya abierto). El sistema nunca abre envases por su cuenta."""

    tipo: Literal["consumo_clinico"]
    cantidad: Cantidad = Field(gt=0)
    envases_abiertos_nuevos: int = Field(default=0, ge=0)


class VencimientoRoturaIn(_MovimientoBase):
    tipo: Literal["vencimiento_rotura"]
    envases: int = Field(default=0, ge=0)
    cantidad_abierta: Cantidad = Field(default=Decimal("0"), ge=0)

    @model_validator(mode="after")
    def algo_para_dar_de_baja(self) -> VencimientoRoturaIn:
        if self.envases == 0 and self.cantidad_abierta == 0:
            raise ValueError("Indicá envases cerrados y/o cantidad abierta a dar de baja")
        return self


class AjusteIn(_MovimientoBase):
    """Recuento físico: se informan los valores reales y el sistema calcula la diferencia."""

    tipo: Literal["ajuste"]
    envases_cerrados_real: int = Field(ge=0)
    cantidad_abierta_real: Cantidad = Field(default=Decimal("0"), ge=0)


MovimientoCreate = Annotated[
    Union[CompraIn, ConsumoClinicoIn, VencimientoRoturaIn, AjusteIn],
    Field(discriminator="tipo"),
]


class MovimientoItem(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    unidad: Unidad
    tipo: TipoMovimiento
    destino: Destino | None = None
    delta_envases_cerrados: int
    delta_cantidad_abierta: Decimal
    fecha: datetime
    usuario_id: int
    usuario_username: str
    venta_id: int | None = None
    fecha_vencimiento: date | None = None
    observaciones: str | None = None


class MovimientoResultado(BaseModel):
    """`movimiento` es None solo cuando un recuento coincide con lo registrado: no hay
    diferencia que mover, pero se confirma el stock y se quita la marca de revisión."""

    movimiento: MovimientoItem | None
    producto: ProductoItem
    advertencias: list[str]


class MovimientoListResponse(BaseModel):
    items: list[MovimientoItem]
    total: int
    page: int
    page_size: int


# --- Análisis ---


class VencimientoItem(BaseModel):
    movimiento_id: int
    producto_id: int
    producto_nombre: str
    fecha_vencimiento: date
    envases_ingresados: int
    vencido: bool


class UsoProductoItem(BaseModel):
    producto_id: int
    producto_nombre: str
    rubro_nombre: str
    unidad: Unidad
    petshop_envases: Decimal
    consultorio_cantidad: Decimal
    consultorio_envases: Decimal


class UsoRubroItem(BaseModel):
    rubro_nombre: str
    petshop_envases: Decimal
    consultorio_envases: Decimal


class AlertasStock(BaseModel):
    revisar_stock: list[ProductoItem]
    bajo_minimo: list[ProductoItem]
    proximos_vencimientos: list[VencimientoItem]
    dias_alerta_vencimiento: int


class AnalisisResponse(BaseModel):
    desde: datetime
    hasta: datetime
    alertas: AlertasStock
    uso_por_producto: list[UsoProductoItem]
    uso_por_rubro: list[UsoRubroItem]
    productos_activos: int
    valor_inventario_costo: Decimal
