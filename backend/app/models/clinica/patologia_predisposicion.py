from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class PatologiaPredisposicion(SQLModel, table=True):
    """Matriz demográfica de predisposición. Sugerencia estadística; no es un diagnóstico."""

    __tablename__ = "patologia_predisposicion"
    __table_args__ = {"schema": "clinica"}

    predisposicion_id: int | None = Field(default=None, primary_key=True)
    patologia_id: int = Field(foreign_key="clinica.patologia.id", nullable=False)
    especie_id: int | None = Field(default=None)
    raza_id: int | None = Field(default=None, foreign_key="clinica.raza.id")
    estado_reproductivo_id: int | None = Field(
        default=None, foreign_key="catalogo.estado_reproductivo.id"
    )
    habitat_id: int | None = Field(default=None, foreign_key="catalogo.habitat.id")
    tamanio_id: int | None = Field(default=None, foreign_key="catalogo.tamanio.id")
    rango_edad_meses_min: int | None = Field(default=None)
    rango_edad_meses_max: int | None = Field(default=None)

    patologia: Mapped["Patologia"] = Relationship(back_populates="predisposiciones")
