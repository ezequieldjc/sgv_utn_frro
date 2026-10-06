from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel


class Turno(SQLModel, table=True):
    """Turno de la agenda.

    Las restricciones de exclusión (`EX_Turno_SinSuperposicion` por veterinario y
    `EX_Turno_MascotaSinSuperposicion` por mascota) viven solo en PostgreSQL
    (ver scripts/agenda/001_agenda_turno.sql). El service replica esas reglas para
    devolver errores claros y para que los tests en SQLite las cubran.
    """

    __tablename__ = "turno"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('solicitado','confirmado','realizado','cancelado','no_asistio')",
            name="CK_Turno_Estado",
        ),
        CheckConstraint(
            "canal_origen IN ('mostrador','telefono','whatsapp','portal')",
            name="CK_Turno_Canal",
        ),
        CheckConstraint("fecha_hora_fin > fecha_hora_inicio", name="CK_Turno_Rango"),
        {"schema": "agenda"},
    )

    id: int | None = Field(default=None, primary_key=True)
    mascota_id: int = Field(foreign_key="clinica.mascota.id", nullable=False)
    veterinario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    tipo_turno_id: int = Field(foreign_key="agenda.tipo_turno.id", nullable=False)
    fecha_hora_inicio: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    fecha_hora_fin: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    estado: str = Field(default="solicitado", max_length=20, nullable=False)
    canal_origen: str = Field(default="mostrador", max_length=20, nullable=False)
