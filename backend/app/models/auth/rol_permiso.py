from __future__ import annotations

from sqlmodel import Field, SQLModel


class RolPermiso(SQLModel, table=True):
    """Tabla intermedia que relaciona roles y permisos."""

    __tablename__ = "rol_permiso"
    __table_args__ = {"schema": "auth"}

    rol_id: int | None = Field(default=None, foreign_key="auth.rol.id", primary_key=True)
    permiso_id: int | None = Field(default=None, foreign_key="auth.permiso.id", primary_key=True)
