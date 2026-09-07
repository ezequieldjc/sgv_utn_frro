<<<<<<< HEAD
from typing import Optional

=======
>>>>>>> 916b3f3cec9cf2bc213928b410b7cafbf7b6199a
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Pelaje(SQLModel, table=True):
    __tablename__ = "pelaje"
    __table_args__ = {"schema": "catalogo"}

    id: int | None = Field(default=None, primary_key=True)
<<<<<<< HEAD
    especie_id: int | None = Field(default=None, foreign_key="clinica.especie.id")
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)
    activo: bool = Field(default=True, nullable=False)

    especie: Mapped[Optional["Especie"]] = Relationship()
=======
    especie_id: int | None = Field(default=None)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="pelaje")
>>>>>>> 916b3f3cec9cf2bc213928b410b7cafbf7b6199a
