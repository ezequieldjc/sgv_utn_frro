from datetime import datetime

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
    sexo: str | None = Field(default=None, max_length=1)
    mail: str | None = Field(default=None, max_length=100)
    celular: str = Field(max_length=30, nullable=False)
    fecha_alta: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    usuario: Mapped["Usuario"] = Relationship(
        back_populates="persona",
        sa_relationship_kwargs={"uselist": False},
    )
