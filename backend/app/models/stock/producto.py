from decimal import Decimal

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class Producto(SQLModel, table=True):
    """Producto del inventario único (consultorio + pet shop).

    Stock en dos saldos: `envases_cerrados` (lo único que se vende) y `cantidad_abierta`
    (remanente de envases abiertos, en `unidad`). Solo cambian a través de movimientos y
    nunca quedan negativos: si una salida supera lo registrado, el saldo queda en 0, se
    registra un ajuste automático por el faltante y `requiere_revision` pasa a True hasta
    el próximo ajuste por recuento.
    """

    __tablename__ = "producto"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Producto_Nombre"),
        CheckConstraint(
            "unidad IN ('unidad','ml','comprimido','g','kg')", name="CK_Producto_Unidad"
        ),
        CheckConstraint("contenido_envase > 0", name="CK_Producto_Contenido"),
        CheckConstraint("stock_minimo >= 0", name="CK_Producto_Minimo"),
        CheckConstraint(
            "COALESCE(precio_costo,0) >= 0 AND COALESCE(precio_venta,0) >= 0",
            name="CK_Producto_Precios",
        ),
        CheckConstraint("fraccionable OR cantidad_abierta = 0", name="CK_Producto_Fraccion"),
        CheckConstraint("envases_cerrados >= 0", name="CK_Producto_CerradosNoNegativo"),
        CheckConstraint("cantidad_abierta >= 0", name="CK_Producto_AbiertaNoNegativa"),
        {"schema": "stock"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    rubro_id: int = Field(foreign_key="catalogo.rubro.id", nullable=False)
    proveedor: str | None = Field(default=None, max_length=100)
    unidad: str = Field(max_length=20, nullable=False)
    contenido_envase: Decimal = Field(
        default=Decimal("1"), max_digits=10, decimal_places=3, nullable=False
    )
    fraccionable: bool = Field(default=False, nullable=False)
    envases_cerrados: int = Field(default=0, nullable=False)
    cantidad_abierta: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=3, nullable=False
    )
    stock_minimo: int = Field(default=0, nullable=False)
    precio_costo: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    precio_venta: Decimal | None = Field(default=None, max_digits=12, decimal_places=2)
    activo: bool = Field(default=True, nullable=False)
    requiere_revision: bool = Field(default=False, nullable=False)
