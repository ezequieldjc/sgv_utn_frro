from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from app.models.auth.usuario import Usuario
    from app.models.clinica.mascota import Mascota
    from app.models.core.domicilio import Domicilio


class Persona(SQLModel, table=True):
    """Entidad de persona física que puede ser cliente, veterinario o usuario del sistema."""

    __tablename__ = "persona"
    __table_args__ = (
        UniqueConstraint("dni", name="UQ_Persona_DNI"),
        {"schema": "core"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    apellido: str = Field(max_length=100, nullable=False)
    dni: str = Field(max_length=20, nullable=False)
    sexo: str | None = Field(default=None, max_length=1)
    domicilio_id: int | None = Field(default=None, foreign_key="core.domicilio.id")
    mail: str | None = Field(default=None, max_length=100)
    celular: str = Field(max_length=30, nullable=False)
    fecha_alta: datetime = Field(default_factory=datetime.utcnow)

    domicilio: Optional["Domicilio"] = Relationship(back_populates="personas")
    usuario: Optional["Usuario"] = Relationship(back_populates="persona")
    mascotas: list["Mascota"] = Relationship(back_populates="persona")
