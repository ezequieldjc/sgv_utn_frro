from datetime import date, datetime

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Persona(SQLModel, table=True):
    __tablename__ = "persona"
    __table_args__ = (
        UniqueConstraint("dni", name="UQ_Persona_DNI"),
        {"schema": "core"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    apellido: str = Field(max_length=100, nullable=False)
    dni: str = Field(max_length=20, nullable=False)
    sexo: str = Field(max_length=1, nullable=False)
    fecha_nacimiento: date = Field(nullable=False)
    domicilio_id: int | None = Field(default=None, foreign_key="core.domicilio.id")
    mail: str | None = Field(default=None, max_length=100)
    celular: str = Field(max_length=30, nullable=False)
    fecha_alta: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    domicilio: Mapped["Domicilio"] = Relationship(back_populates="personas")
    usuario: Mapped["Usuario"] = Relationship(
        back_populates="persona",
        sa_relationship_kwargs={"uselist": False},
    )
