from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class Consulta(SQLModel, table=True):
    """Consulta clínica: nace en `borrador` y la firma la cierra (`firmada` = solo lectura).

    DDL en scripts/clinica/005_historia_clinica.sql. Los índices IX_Consulta_* viven solo en
    PostgreSQL. Dictados y signos se borran en cascada con la consulta; una consulta con
    diagnósticos no se puede borrar.
    """

    __tablename__ = "consulta"
    __table_args__ = (
        UniqueConstraint("turno_id", name="UQ_Consulta_Turno"),
        CheckConstraint("estado IN ('borrador','firmada')", name="CK_Consulta_Estado"),
        CheckConstraint(
            "(estado = 'firmada') = (fecha_firma IS NOT NULL)", name="CK_Consulta_Firma"
        ),
        CheckConstraint(
            "peso_kg IS NULL OR (peso_kg > 0 AND peso_kg <= 150)", name="CK_Consulta_Peso"
        ),
        CheckConstraint(
            "temperatura_c IS NULL OR temperatura_c BETWEEN 30 AND 45",
            name="CK_Consulta_Temperatura",
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    mascota_id: int = Field(foreign_key="clinica.mascota.id", nullable=False)
    veterinario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    turno_id: int | None = Field(default=None, foreign_key="agenda.turno.id")
    fecha_hora: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    motivo: str | None = Field(default=None)
    anamnesis: str | None = Field(default=None)
    examen_fisico: str | None = Field(default=None)
    peso_kg: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    temperatura_c: Decimal | None = Field(default=None, max_digits=4, decimal_places=1)
    tratamiento: str | None = Field(default=None)
    observaciones: str | None = Field(default=None)
    estado: str = Field(default="borrador", max_length=20, nullable=False)
    consulta_padre_id: int | None = Field(default=None, foreign_key="clinica.consulta.id")
    fecha_firma: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    fecha_creacion: datetime | None = Field(
        default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    fecha_modificacion: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
