from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.auth.usuario import Usuario


class HistorialContrasena(SQLModel, table=True):
    """Historial de contraseñas para control de rotación."""

    __tablename__ = "historial_contrasena"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    hashed_password: str = Field(max_length=255, nullable=False)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)
    debe_cambiar: bool = Field(default=True, nullable=False)

    usuario: Optional["Usuario"] = Relationship(back_populates="historial_contrasenas")
