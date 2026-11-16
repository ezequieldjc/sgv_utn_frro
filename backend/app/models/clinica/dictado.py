from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now

# jsonb en PostgreSQL; JSON común en la SQLite de los tests.
# none_as_null: un None de Python se guarda como NULL de SQL (no como el JSON `null`).
JSON_VARIANTE = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")


class Dictado(SQLModel, table=True):
    """Una fila por grabación, tal como la devolvió el NLP. No se edita.

    DDL en scripts/clinica/005_historia_clinica.sql. Una consulta puede tener varios dictados
    (ordenados por `fecha_creacion`). El audio no se guarda.
    """

    __tablename__ = "dictado"
    __table_args__ = {"schema": "clinica"}

    id: int | None = Field(default=None, primary_key=True)
    consulta_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("clinica.consulta.id", ondelete="CASCADE"), nullable=False
        )
    )
    transcripcion: str = Field(nullable=False)
    extraccion_json: dict[str, Any] = Field(sa_column=Column(JSON_VARIANTE, nullable=False))
    modelo_stt: str = Field(max_length=60, nullable=False)
    modelo_llm: str | None = Field(default=None, max_length=60)
    version_prompt: str | None = Field(default=None, max_length=20)
    duracion_audio_s: Decimal | None = Field(default=None, max_digits=6, decimal_places=1)
    latencia_stt_ms: int | None = Field(default=None)
    latencia_llm_ms: int | None = Field(default=None)
    fecha_creacion: datetime = Field(
        default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False)
    )
