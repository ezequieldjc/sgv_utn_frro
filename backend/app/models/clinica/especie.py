from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Especie(SQLModel, table=True):
    __tablename__ = "especie"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Especie_Nombre"),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None)
    activo: bool = Field(default=True, nullable=False)

    razas: Mapped[list["Raza"]] = Relationship(back_populates="especie")
