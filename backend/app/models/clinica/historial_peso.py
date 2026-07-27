from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DECIMAL, Column
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from app.models.clinica.mascota import Mascota


class HistorialPeso(SQLModel, table=True):
    """Historial de pesos de una mascota."""

    __tablename__ = "historial_peso"
    __table_args__ = (
        UniqueConstraint("mascota_id", "fecha", name="UQ_HP_MascotaFecha"),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    mascota_id: int = Field(foreign_key="clinica.mascota.id", nullable=False)
    fecha: datetime = Field(default_factory=datetime.utcnow)
    peso_kg: Decimal = Field(
        default=None,
        sa_column=Column(DECIMAL(5, 2), nullable=False),
    )

    mascota: Optional["Mascota"] = Relationship(back_populates="historiales_peso")
