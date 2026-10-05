from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class TipoTurno(SQLModel, table=True):
    __tablename__ = "tipo_turno"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_TipoTurno_Nombre"),
        CheckConstraint(
            "duracion_min > 0 AND duracion_min % 30 = 0", name="CK_TipoTurno_Duracion"
        ),
        {"schema": "agenda"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    duracion_min: int = Field(nullable=False)
    activo: bool = Field(default=True, nullable=False)
