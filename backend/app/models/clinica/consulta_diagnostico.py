from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, CheckConstraint, Column, DateTime, Index, SmallInteger, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now

# jsonb en PostgreSQL; JSON común en la SQLite de los tests.
# none_as_null: un None de Python se guarda como NULL de SQL (no como el JSON `null`).
JSON_VARIANTE = JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")


class ConsultaDiagnostico(SQLModel, table=True):
    """Diagnósticos que el veterinario aceptó: uno principal y los secundarios.

    DDL en scripts/clinica/005_historia_clinica.sql. Las sugerencias descartadas del motor no se
    guardan. `ranking`, `probabilidad_pct`, `explicacion` y `version_motor` solo se completan en
    los de origen `sugerido_ia`. Que una consulta firmada tenga exactamente un principal lo valida
    el backend al firmar.
    """

    __tablename__ = "consulta_diagnostico"
    __table_args__ = (
        CheckConstraint(
            "tipo_diagnostico IN ('principal','secundario')", name="CK_ConsultaDx_Tipo"
        ),
        CheckConstraint("origen IN ('manual','sugerido_ia')", name="CK_ConsultaDx_Origen"),
        CheckConstraint(
            "ranking IS NULL OR ranking BETWEEN 1 AND 3", name="CK_ConsultaDx_Ranking"
        ),
        CheckConstraint(
            "probabilidad_pct IS NULL OR probabilidad_pct BETWEEN 0 AND 100",
            name="CK_ConsultaDx_Pct",
        ),
        CheckConstraint(
            "patologia_id IS NOT NULL OR descripcion_libre IS NOT NULL",
            name="CK_ConsultaDx_Contenido",
        ),
        CheckConstraint(
            "origen <> 'sugerido_ia' OR (patologia_id IS NOT NULL AND ranking IS NOT NULL "
            "AND probabilidad_pct IS NOT NULL)",
            name="CK_ConsultaDx_IA",
        ),
        CheckConstraint(
            "origen <> 'manual' OR (ranking IS NULL AND probabilidad_pct IS NULL "
            "AND explicacion IS NULL AND version_motor IS NULL)",
            name="CK_ConsultaDx_Manual",
        ),
        Index(
            "UQ_ConsultaDx_Principal",
            "consulta_id",
            unique=True,
            postgresql_where=text("tipo_diagnostico = 'principal'"),
            sqlite_where=text("tipo_diagnostico = 'principal'"),
        ),
        Index(
            "UQ_ConsultaDx_Patologia",
            "consulta_id",
            "patologia_id",
            unique=True,
            postgresql_where=text("patologia_id IS NOT NULL"),
            sqlite_where=text("patologia_id IS NOT NULL"),
        ),
        Index(
            "UQ_ConsultaDx_Ranking",
            "consulta_id",
            "ranking",
            unique=True,
            postgresql_where=text("ranking IS NOT NULL"),
            sqlite_where=text("ranking IS NOT NULL"),
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    consulta_id: int = Field(foreign_key="clinica.consulta.id", nullable=False)
    patologia_id: int | None = Field(default=None, foreign_key="clinica.patologia.id")
    descripcion_libre: str | None = Field(default=None, max_length=255)
    tipo_diagnostico: str = Field(default="secundario", max_length=20, nullable=False)
    origen: str = Field(default="manual", max_length=20, nullable=False)
    ranking: int | None = Field(default=None, sa_column=Column(SmallInteger, nullable=True))
    probabilidad_pct: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    explicacion: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON_VARIANTE, nullable=True)
    )
    version_motor: str | None = Field(default=None, max_length=20)
    confirmado_por_usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    fecha_creacion: datetime | None = Field(
        default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
