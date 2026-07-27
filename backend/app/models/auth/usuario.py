from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

if TYPE_CHECKING:
    from app.models.auth.rol import Rol
    from app.models.auth.historial_contrasena import HistorialContrasena
    from app.models.auth.login import Login
    from app.models.core.persona import Persona


class Usuario(SQLModel, table=True):
    """Usuario autenticable del sistema."""

    __tablename__ = "usuario"
    __table_args__ = (
        UniqueConstraint("persona_id", name="UQ_Usuario_Persona"),
        UniqueConstraint("username", name="UQ_Usuario_Username"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="core.persona.id", nullable=False)
    username: str = Field(max_length=50, nullable=False)
    habilitado: bool = Field(default=True, nullable=False)
    rol_id: int = Field(foreign_key="auth.rol.id", nullable=False)
    version_token: int = Field(default=1, nullable=False)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow)

    persona: Optional["Persona"] = Relationship(back_populates="usuario")
    rol: Optional["Rol"] = Relationship(back_populates="usuarios")
    historial_contrasenas: list["HistorialContrasena"] = Relationship(back_populates="usuario")
    logins: list["Login"] = Relationship(back_populates="usuario")
