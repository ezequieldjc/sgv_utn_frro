from decimal import Decimal

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class Patologia(SQLModel, table=True):
    """Patologías candidatas del motor de diagnóstico (ver docs/modelo_datos_v2.md).

    DDL en scripts/clinica/001_patologia.sql. `codigo` no cambia nunca.
    """

    __tablename__ = "patologia"
    __table_args__ = (
        CheckConstraint(
            "nivel_gravedad IS NULL OR nivel_gravedad IN "
            "('Baja', 'Moderada', 'Alta', 'Crítica')",
            name="patologia_nivel_gravedad_check",
        ),
        UniqueConstraint("codigo", name="UQ_Patologia_Codigo"),
        CheckConstraint(
            "prevalencia > 0 AND prevalencia <= 1", name="CK_Patologia_Prevalencia"
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=160, nullable=False)
    descripcion: str | None = Field(default=None)
    nivel_gravedad: str | None = Field(default=None, max_length=20)
    codigo: str = Field(max_length=100, nullable=False)
    nombre_en: str | None = Field(default=None, max_length=160)
    categoria: str | None = Field(default=None, max_length=80)
    prevalencia: Decimal = Field(max_digits=6, decimal_places=5, nullable=False)
    prevalencia_nivel: str = Field(max_length=20, nullable=False)
    solo_razas_predispuestas: bool = Field(default=False, nullable=False)
    activo: bool = Field(default=True, nullable=False)
