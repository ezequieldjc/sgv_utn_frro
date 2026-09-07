from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Raza(SQLModel, table=True):
    __tablename__ = "raza"
    __table_args__ = {"schema": "clinica"}

    id: int | None = Field(default=None, primary_key=True)
    especie_id: int = Field(foreign_key="clinica.especie.id", nullable=False)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None)
    activo: bool = Field(default=True, nullable=False)

    especie: Mapped["Especie"] = Relationship(back_populates="razas")
    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="raza")
