from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlmodel import Field, SQLModel


class Sintoma(SQLModel, table=True):
    """Catálogo de signos que comparten el NLP, el veterinario y el motor.

    DDL en scripts/clinica/004_sintoma.sql. `codigo` no cambia nunca.
    """

    __tablename__ = "sintoma"
    __table_args__ = (
        UniqueConstraint("codigo", name="UQ_Sintoma_Codigo"),
        CheckConstraint("tipo IN ('observable','examen')", name="CK_Sintoma_Tipo"),
        CheckConstraint(
            "sistema IN ('general','piel','oido','ojo','boca','respiratorio','cardiovascular',"
            "'digestivo','urinario','reproductor','musculoesqueletico','neurologico','conducta')",
            name="CK_Sintoma_Sistema",
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    codigo: str = Field(max_length=40, nullable=False)
    nombre_es: str = Field(max_length=80, nullable=False)
    sistema: str = Field(max_length=20, nullable=False)
    tipo: str = Field(max_length=12, nullable=False)
    activo: bool = Field(default=True, nullable=False)
