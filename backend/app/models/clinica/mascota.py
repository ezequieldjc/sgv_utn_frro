from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DECIMAL, Column
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.clinica.historial_peso import HistorialPeso
    from app.models.clinica.raza import Raza
    from app.models.core.persona import Persona


class Mascota(SQLModel, table=True):
    """Mascota registrada para un dueño."""

    __tablename__ = "mascota"
    __table_args__ = {"schema": "clinica"}

    id: int | None = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="core.persona.id", nullable=False)
    raza_id: int = Field(foreign_key="clinica.raza.id", nullable=False)
    nombre: str = Field(max_length=50, nullable=False)
    fecha_nacimiento: date | None = Field(default=None)
    ultimo_peso: Decimal | None = Field(
        default=None,
        sa_column=Column(DECIMAL(5, 2), nullable=True),
    )
    estado: str = Field(max_length=20, nullable=False)
    fecha_alta: datetime = Field(default_factory=datetime.utcnow)

    persona: Optional["Persona"] = Relationship(back_populates="mascotas")
    raza: Optional["Raza"] = Relationship(back_populates="mascotas")
    historiales_peso: list["HistorialPeso"] = Relationship(back_populates="mascota")
