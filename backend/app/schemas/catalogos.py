from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class EspecieOpcion(BaseModel):
    id: int
    nombre: str
    activo: bool


class CatalogoItem(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    activo: bool
    especie_id: int | None = None
    especie_nombre: str | None = None


class CatalogoConEspecieCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)
    especie_id: int

    @field_validator("nombre")
    @classmethod
    def nombre_trim(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("El nombre es obligatorio")
        return trimmed

    @field_validator("descripcion")
    @classmethod
    def descripcion_trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class CatalogoConEspecieUpdate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)
    especie_id: int

    @field_validator("nombre")
    @classmethod
    def nombre_trim(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("El nombre es obligatorio")
        return trimmed

    @field_validator("descripcion")
    @classmethod
    def descripcion_trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class CatalogoGlobalCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)

    @field_validator("nombre")
    @classmethod
    def nombre_trim(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("El nombre es obligatorio")
        return trimmed

    @field_validator("descripcion")
    @classmethod
    def descripcion_trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class CatalogoGlobalUpdate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = Field(default=None, max_length=255)

    @field_validator("nombre")
    @classmethod
    def nombre_trim(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("El nombre es obligatorio")
        return trimmed

    @field_validator("descripcion")
    @classmethod
    def descripcion_trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class CatalogoActivoUpdate(BaseModel):
    activo: bool
