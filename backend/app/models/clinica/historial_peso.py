from datetime import datetime
from decimal import Decimal

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class HistorialPeso(SQLModel, table=True):
    __tablename__ = "historial_peso"
    __table_args__ = (
        UniqueConstraint("mascota_id", "fecha", name="UQ_HP_MascotaFecha"),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    mascota_id: int = Field(foreign_key="clinica.mascota.id", nullable=False)
    fecha: datetime = Field(nullable=False)
    peso_kg: Decimal = Field(max_digits=5, decimal_places=2, nullable=False)

    mascota: Mapped["Mascota"] = Relationship(back_populates="historial_pesos")
