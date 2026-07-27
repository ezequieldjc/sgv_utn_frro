from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.clinica.especie import Especie
    from app.models.clinica.mascota import Mascota


class Raza(SQLModel, table=True):
    """Raza asociada a una especie."""

    __tablename__ = "raza"
    __table_args__ = {"schema": "clinica"}

    id: int | None = Field(default=None, primary_key=True)
    especie_id: int = Field(foreign_key="clinica.especie.id", nullable=False)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None)
    activo: bool = Field(default=True, nullable=False)

    especie: Optional["Especie"] = Relationship(back_populates="razas")
    mascotas: list["Mascota"] = Relationship(back_populates="raza")
