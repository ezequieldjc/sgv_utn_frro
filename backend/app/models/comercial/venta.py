from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class Venta(SQLModel, table=True):
    __tablename__ = "venta"
    __table_args__ = (
        CheckConstraint(
            "medio_pago IN ('efectivo','debito','credito','transferencia')",
            name="CK_Venta_MedioPago",
        ),
        CheckConstraint("total >= 0", name="CK_Venta_Total"),
        {"schema": "comercial"},
    )

    id: int | None = Field(default=None, primary_key=True)
    persona_id: int | None = Field(default=None, foreign_key="core.persona.id")
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    fecha: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    total: Decimal = Field(max_digits=12, decimal_places=2, nullable=False)
    medio_pago: str = Field(max_length=20, nullable=False)
