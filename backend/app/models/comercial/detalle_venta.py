from decimal import Decimal

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class DetalleVenta(SQLModel, table=True):
    __tablename__ = "detalle_venta"
    __table_args__ = (
        UniqueConstraint("venta_id", "producto_id", name="UQ_DetalleVenta_Producto"),
        CheckConstraint("cantidad > 0", name="CK_DetalleVenta_Cantidad"),
        {"schema": "comercial"},
    )

    id: int | None = Field(default=None, primary_key=True)
    venta_id: int = Field(foreign_key="comercial.venta.id", nullable=False)
    producto_id: int = Field(foreign_key="stock.producto.id", nullable=False)
    cantidad: int = Field(nullable=False)
    precio_unitario: Decimal = Field(max_digits=12, decimal_places=2, nullable=False)
