from __future__ import annotations

from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint

from app.models.auth.rol_permiso import RolPermiso

if TYPE_CHECKING:
    from app.models.auth.rol import Rol


class Permiso(SQLModel, table=True):
    """Permiso atómico utilizado para RBAC."""

    __tablename__ = "permiso"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Permiso_Nombre"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    roles: list["Rol"] = Relationship(back_populates="permisos", link_model=RolPermiso)
