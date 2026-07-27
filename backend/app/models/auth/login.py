from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.auth.usuario import Usuario


class Login(SQLModel, table=True):
    """Registro de intentos de autenticación."""

    __tablename__ = "login"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int | None = Field(default=None, foreign_key="auth.usuario.id")
    username_ingresado: str = Field(max_length=50, nullable=False)
    fecha: datetime = Field(default_factory=datetime.utcnow)
    exito: bool = Field(nullable=False)
    ip: str = Field(nullable=False)
    razon_fallo: str | None = Field(default=None, max_length=50)

    usuario: Optional["Usuario"] = Relationship(back_populates="logins")
