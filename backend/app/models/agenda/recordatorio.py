from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, Text
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class Recordatorio(SQLModel, table=True):
    """Recordatorio enviado al tutor: de un turno o de una dosis por vencer.

    DDL en scripts/clinica/008_vacunas_recordatorios.sql. En el prototipo el envío lo hace la
    recepción desde WhatsApp (link wa.me) y acá queda el registro, con `estado = 'enviado'`.
    La Fase 2 suma el envío automático: `usuario_id` nulo y los estados 'pendiente' y 'error'.
    """

    __tablename__ = "recordatorio"
    __table_args__ = (
        CheckConstraint("tipo IN ('turno','dosis')", name="CK_Recordatorio_Tipo"),
        CheckConstraint(
            "(tipo = 'turno' AND turno_id IS NOT NULL AND tratamiento_preventivo_id IS NULL) "
            "OR (tipo = 'dosis' AND tratamiento_preventivo_id IS NOT NULL AND turno_id IS NULL)",
            name="CK_Recordatorio_Origen",
        ),
        CheckConstraint("canal IN ('whatsapp')", name="CK_Recordatorio_Canal"),
        CheckConstraint(
            "estado IN ('pendiente','enviado','error')", name="CK_Recordatorio_Estado"
        ),
        {"schema": "agenda"},
    )

    id: int | None = Field(default=None, primary_key=True)
    tipo: str = Field(max_length=20, nullable=False)
    turno_id: int | None = Field(default=None, foreign_key="agenda.turno.id")
    tratamiento_preventivo_id: int | None = Field(
        default=None, foreign_key="clinica.tratamiento_preventivo.id"
    )
    persona_id: int = Field(foreign_key="core.persona.id", nullable=False)
    canal: str = Field(default="whatsapp", max_length=20, nullable=False)
    destino: str = Field(max_length=30, nullable=False)
    mensaje: str = Field(sa_column=Column(Text, nullable=False))
    estado: str = Field(default="enviado", max_length=20, nullable=False)
    fecha_envio: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    usuario_id: int | None = Field(default=None, foreign_key="auth.usuario.id")
