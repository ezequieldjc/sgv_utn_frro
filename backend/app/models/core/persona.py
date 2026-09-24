from datetime import date, datetime
from typing import Optional

from sqlalchemy import Column, DateTime
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel

from app.core.time_utils import utc_now


class Persona(SQLModel, table=True):
    __tablename__ = "persona"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    apellido: str = Field(max_length=100, nullable=False)
    dni: str | None = Field(default=None, max_length=20, nullable=True)
    sexo: str | None = Field(default=None, max_length=1, nullable=True)
    fecha_nacimiento: date | None = Field(default=None, nullable=True)
    domicilio_id: int | None = Field(default=None, foreign_key="core.domicilio.id")
    mail: str | None = Field(default=None, max_length=100, nullable=True)
    celular: str = Field(max_length=30, nullable=False)
    fecha_alta: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    es_cliente: bool = Field(default=True, nullable=False)

    domicilio: Mapped[Optional["Domicilio"]] = Relationship(back_populates="personas")
    usuario: Mapped["Usuario"] = Relationship(
        back_populates="persona",
        sa_relationship_kwargs={"uselist": False},
    )
    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="persona")
