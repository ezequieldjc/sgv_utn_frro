from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.core.persona import Persona


class Domicilio(SQLModel, table=True):
    """Entidad de domicilio utilizada por personas y clientes."""

    __tablename__ = "domicilio"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    pais: str = Field(max_length=50, nullable=False)
    provincia: str = Field(max_length=50, nullable=False)
    ciudad: str = Field(max_length=50, nullable=False)
    cp: str | None = Field(default=None, max_length=10)
    calle: str = Field(max_length=100, nullable=False)
    altura: str = Field(max_length=10, nullable=False)
    departamento: str | None = Field(default=None, max_length=20)
    notas: str | None = Field(default=None)

    personas: list["Persona"] = Relationship(back_populates="domicilio")
