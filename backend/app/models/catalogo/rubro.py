from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Rubro(SQLModel, table=True):
    """Rubro de producto (catálogo global, sin filtro por especie)."""

    __tablename__ = "rubro"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Rubro_Nombre"),
        {"schema": "catalogo"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)
    activo: bool = Field(default=True, nullable=False)
