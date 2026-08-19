from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class UsuarioListItem(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str
    habilitado: bool
    rol_id: int
    rol_nombre: str
    ultimo_inicio_sesion: datetime | None = Field(default=None)


class UsuarioHabilitadoUpdate(BaseModel):
    habilitado: bool


class DomicilioCreate(BaseModel):
    pais: str = Field(min_length=1, max_length=50)
    provincia: str = Field(min_length=1, max_length=50)
    ciudad: str = Field(min_length=1, max_length=50)
    calle: str = Field(min_length=1, max_length=100)
    altura: str = Field(min_length=1, max_length=10)
    cp: str = Field(min_length=1, max_length=10)
    departamento: str | None = Field(default=None, max_length=20)
    notas: str | None = Field(default=None)

    @field_validator("cp")
    @classmethod
    def cp_solo_digitos(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("El código postal debe contener solo números")
        return value


class UsuarioCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=1, max_length=20)
    fecha_nacimiento: date
    sexo: Literal["M", "F", "X"]
    celular: str = Field(min_length=1, max_length=30)
    mail: str | None = Field(default=None, max_length=100)
    domicilio: DomicilioCreate
    rol_id: int
    habilitado: bool = True

    @field_validator("dni")
    @classmethod
    def dni_solo_digitos(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("El DNI debe contener solo números")
        return value

    @field_validator("celular")
    @classmethod
    def celular_solo_digitos(cls, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if not digits:
            raise ValueError("El celular debe contener al menos un dígito")
        return digits

    @field_validator("mail")
    @classmethod
    def mail_formato(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        normalized = value.strip()
        if "@" not in normalized or "." not in normalized.split("@")[-1]:
            raise ValueError("El email no tiene un formato válido")
        return normalized


class UsuarioCreateResponse(BaseModel):
    id: int
    username: str
    password_temporal: str
    debe_cambiar: bool


class UsuarioRestablecerResponse(BaseModel):
    mensaje: str
    usuario_id: int
    username: str
    password_temporal: str
