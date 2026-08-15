from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Domicilio(SQLModel, table=True):
    """Domicilio de una persona; atributo de Persona persistido en tabla separada."""

    __tablename__ = "domicilio"
    __table_args__ = {"schema": "core"}

    id: int | None = Field(default=None, primary_key=True)
    pais: str = Field(max_length=50, nullable=False)
    provincia: str = Field(max_length=50, nullable=False)
    ciudad: str = Field(max_length=50, nullable=False)
    cp: str = Field(max_length=10, nullable=False)
    calle: str = Field(max_length=100, nullable=False)
    altura: str = Field(max_length=10, nullable=False)
    departamento: str | None = Field(default=None, max_length=20)
    notas: str | None = Field(default=None)

    personas: Mapped[list["Persona"]] = Relationship(back_populates="domicilio")
