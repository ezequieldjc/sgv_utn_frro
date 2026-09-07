<<<<<<< HEAD
from sqlmodel import Field, SQLModel


class MascotaEstado(SQLModel, table=True):
    """Estado operativo de una mascota (catálogo global, sin especie)."""
=======
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class MascotaEstado(SQLModel, table=True):
    """Estado operativo de una mascota (catálogo global, sin filtro por especie)."""
>>>>>>> 916b3f3cec9cf2bc213928b410b7cafbf7b6199a

    __tablename__ = "mascota_estado"
    __table_args__ = {"schema": "catalogo"}

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)
<<<<<<< HEAD
    activo: bool = Field(default=True, nullable=False)
=======

    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="mascota_estado")
>>>>>>> 916b3f3cec9cf2bc213928b410b7cafbf7b6199a
