from typing import Optional

from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Temperamento(SQLModel, table=True):
    __tablename__ = "temperamento"
    __table_args__ = {"schema": "catalogo"}

    id: int | None = Field(default=None, primary_key=True)
    especie_id: int | None = Field(default=None, foreign_key="clinica.especie.id")
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)
    activo: bool = Field(default=True, nullable=False)

    especie: Mapped[Optional["Especie"]] = Relationship()
