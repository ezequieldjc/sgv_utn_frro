from __future__ import annotations

from pydantic import BaseModel, Field


class RolListItem(BaseModel):
    id: int
    nombre: str = Field(min_length=1, max_length=50)


class PermisoItem(BaseModel):
    id: int
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = None


class RolDetail(BaseModel):
    id: int
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = None
    es_admin: bool
    acceso_total: bool
    permisos: list[PermisoItem]


class RolCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)


class RolPermisosUpdate(BaseModel):
    permiso_ids: list[int]
