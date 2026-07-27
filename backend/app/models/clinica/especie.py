from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from app.models.clinica.raza import Raza


class Especie(SQLModel, table=True):
    """Especie animal."""

    __tablename__ = "especie"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Especie_Nombre"),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None)
    activo: bool = Field(default=True, nullable=False)

    razas: list["Raza"] = Relationship(back_populates="especie")
