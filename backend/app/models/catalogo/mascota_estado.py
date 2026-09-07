from sqlmodel import Field, SQLModel


class MascotaEstado(SQLModel, table=True):
    """Estado operativo de una mascota (catálogo global, sin especie)."""

    __tablename__ = "mascota_estado"
    __table_args__ = {"schema": "catalogo"}

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)
    activo: bool = Field(default=True, nullable=False)
