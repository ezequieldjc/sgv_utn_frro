from sqlalchemy import CheckConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Patologia(SQLModel, table=True):
    """Catálogo de patologías para el motor de predisposición (sugerencia estadística)."""

    __tablename__ = "patologia"
    __table_args__ = (
        CheckConstraint(
            "nivel_gravedad IS NULL OR nivel_gravedad IN "
            "('Baja', 'Moderada', 'Alta', 'Crítica')",
            name="patologia_nivel_gravedad_check",
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=100, nullable=False)
    descripcion: str | None = Field(default=None)
    nivel_gravedad: str | None = Field(default=None, max_length=20)

    predisposiciones: Mapped[list["PatologiaPredisposicion"]] = Relationship(
        back_populates="patologia"
    )
