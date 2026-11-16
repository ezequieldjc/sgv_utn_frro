from decimal import Decimal

from sqlalchemy import CheckConstraint, UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Raza(SQLModel, table=True):
    __tablename__ = "raza"
    __table_args__ = (
        UniqueConstraint("codigo", name="UQ_Raza_Codigo"),
        CheckConstraint(
            "peso_referencia_kg IS NULL OR peso_referencia_kg > 0", name="CK_Raza_PesoRef"
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    especie_id: int = Field(foreign_key="clinica.especie.id", nullable=False)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None)
    activo: bool = Field(default=True, nullable=False)
    # Datos del motor (scripts/clinica/002_raza.sql). Opcionales; talla sin lista definida.
    codigo: str | None = Field(default=None, max_length=60)
    talla: str | None = Field(default=None, max_length=10)
    peso_referencia_kg: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)

    especie: Mapped["Especie"] = Relationship(back_populates="razas")
    mascotas: Mapped[list["Mascota"]] = Relationship(back_populates="raza")
