from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Tamanio(SQLModel, table=True):
    __tablename__ = "tamanio"
    __table_args__ = {"schema": "catalogo"}

    id: int | None = Field(default=None, primary_key=True)
    especie_id: int | None = Field(default=None)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="tamanio")
