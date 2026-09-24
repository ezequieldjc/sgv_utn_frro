from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel

from app.core.time_utils import utc_now


class HistorialContrasena(SQLModel, table=True):
    __tablename__ = "historial_contrasena"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    hashed_password: str = Field(max_length=255, nullable=False)
    fecha_creacion: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    debe_cambiar: bool = Field(default=False, nullable=False)

    usuario: Mapped["Usuario"] = Relationship(back_populates="historial_contrasenas")
