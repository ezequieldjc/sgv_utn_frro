from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class MovimientoStock(SQLModel, table=True):
    """Movimiento de stock: guarda cuánto cambió cada saldo del producto.

    El destino sale del tipo: `venta` = pet shop, `consumo_clinico` = consultorio.
    """

    __tablename__ = "movimiento_stock"
    __table_args__ = (
        CheckConstraint(
            "tipo IN ('compra','venta','consumo_clinico','vencimiento_rotura','ajuste')",
            name="CK_Movimiento_Tipo",
        ),
        CheckConstraint(
            "delta_envases_cerrados <> 0 OR delta_cantidad_abierta <> 0",
            name="CK_Movimiento_Delta",
        ),
        CheckConstraint("(tipo = 'venta') = (venta_id IS NOT NULL)", name="CK_Movimiento_Venta"),
        {"schema": "stock"},
    )

    id: int | None = Field(default=None, primary_key=True)
    producto_id: int = Field(foreign_key="stock.producto.id", nullable=False)
    tipo: str = Field(max_length=30, nullable=False)
    delta_envases_cerrados: int = Field(default=0, nullable=False)
    delta_cantidad_abierta: Decimal = Field(
        default=Decimal("0"), max_digits=12, decimal_places=3, nullable=False
    )
    fecha: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    venta_id: int | None = Field(default=None, foreign_key="comercial.venta.id")
    fecha_vencimiento: date | None = Field(default=None)
    observaciones: str | None = Field(default=None, max_length=255)
