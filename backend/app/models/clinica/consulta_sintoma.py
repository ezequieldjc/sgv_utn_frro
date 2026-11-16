from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, text
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class ConsultaSintoma(SQLModel, table=True):
    """Signos de la consulta, presentes o negados.

    DDL en scripts/clinica/005_historia_clinica.sql. Un signo negado (`presente = False`) no es
    lo mismo que uno no mencionado (sin fila). Un signo con código aparece una sola vez por
    consulta; los textos sin mapear (`sintoma_id` nulo) pueden ser varios.
    """

    __tablename__ = "consulta_sintoma"
    __table_args__ = (
        CheckConstraint("origen IN ('nlp','manual')", name="CK_ConsultaSintoma_Origen"),
        Index(
            "UQ_ConsultaSintoma_Sintoma",
            "consulta_id",
            "sintoma_id",
            unique=True,
            postgresql_where=text("sintoma_id IS NOT NULL"),
            sqlite_where=text("sintoma_id IS NOT NULL"),
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    consulta_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("clinica.consulta.id", ondelete="CASCADE"), nullable=False
        )
    )
    sintoma_id: int | None = Field(default=None, foreign_key="clinica.sintoma.id")
    dictado_id: int | None = Field(
        default=None,
        sa_column=Column(
            Integer, ForeignKey("clinica.dictado.id", ondelete="SET NULL"), nullable=True
        ),
    )
    texto_original: str = Field(max_length=255, nullable=False)
    presente: bool = Field(default=True, nullable=False)
    origen: str = Field(default="nlp", max_length=10, nullable=False)
    confirmado: bool = Field(default=False, nullable=False)
    fecha_creacion: datetime = Field(
        default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False)
    )
