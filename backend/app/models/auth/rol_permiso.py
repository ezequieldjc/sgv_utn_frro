from __future__ import annotations

from sqlmodel import Field, SQLModel


class RolPermiso(SQLModel, table=True):
    __tablename__ = "rol_permiso"
    __table_args__ = {"schema": "auth"}

    rol_id: int = Field(foreign_key="auth.rol.id", primary_key=True, nullable=False)
    permiso_id: int = Field(foreign_key="auth.permiso.id", primary_key=True, nullable=False)
