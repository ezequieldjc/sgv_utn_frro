from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Mascota(SQLModel, table=True):
    __tablename__ = "mascota"
    __table_args__ = (
        CheckConstraint("sexo IS NULL OR sexo IN ('M', 'H', 'U')", name="mascota_sexo_check"),
        UniqueConstraint("microchip", name="mascota_microchip_key"),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="core.persona.id", nullable=False)
    raza_id: int = Field(foreign_key="clinica.raza.id", nullable=False)
    nombre: str = Field(max_length=50, nullable=False)
    fecha_nacimiento: date | None = Field(default=None)
    ultimo_peso: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    sexo: str | None = Field(default=None, max_length=1)
    microchip: str | None = Field(default=None, max_length=15)
    alertas_medicas: str | None = Field(default=None)
    fecha_alta: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    pelaje_id: int | None = Field(default=None, foreign_key="catalogo.pelaje.id")
    tamanio_id: int | None = Field(default=None, foreign_key="catalogo.tamanio.id")
    habitat_id: int | None = Field(default=None, foreign_key="catalogo.habitat.id")
    estado_reproductivo_id: int | None = Field(
        default=None, foreign_key="catalogo.estado_reproductivo.id"
    )
    temperamento_id: int | None = Field(default=None, foreign_key="catalogo.temperamento.id")
    mascota_estado_id: int = Field(foreign_key="catalogo.mascota_estado.id", nullable=False)

    persona: Mapped["Persona"] = Relationship(back_populates="mascotas")
    raza: Mapped["Raza"] = Relationship(back_populates="mascotas")
    pelaje: Mapped[Optional["Pelaje"]] = Relationship(back_populates="mascotas")
    tamanio: Mapped[Optional["Tamanio"]] = Relationship(back_populates="mascotas")
    habitat: Mapped[Optional["Habitat"]] = Relationship(back_populates="mascotas")
    estado_reproductivo: Mapped[Optional["EstadoReproductivo"]] = Relationship(
        back_populates="mascotas"
    )
    temperamento: Mapped[Optional["Temperamento"]] = Relationship(back_populates="mascotas")
    mascota_estado: Mapped["MascotaEstado"] = Relationship(back_populates="mascotas")
    historial_pesos: Mapped[list["HistorialPeso"]] = Relationship(back_populates="mascota")
