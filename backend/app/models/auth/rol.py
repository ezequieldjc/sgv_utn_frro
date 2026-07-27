from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from app.models.auth.rol_permiso import RolPermiso

if TYPE_CHECKING:
    from app.models.auth.permiso import Permiso
    from app.models.auth.usuario import Usuario


class Rol(SQLModel, table=True):
    """Rol del sistema para control de acceso."""

    __tablename__ = "rol"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Rol_Nombre"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    usuarios: list["Usuario"] = Relationship(back_populates="rol")
    permisos: list["Permiso"] = Relationship(back_populates="roles", link_model=RolPermiso)
