from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.usuarios import DomicilioCreate


class ClienteListItem(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str
    sexo: str
    celular: str
    fecha_alta: datetime
    ciudad: str | None = Field(default=None)
    edad: int


class ClienteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=1, max_length=20)
    fecha_nacimiento: date
    sexo: Literal["M", "F", "X"]
    celular: str = Field(min_length=1, max_length=30)
    mail: str | None = Field(default=None, max_length=100)
    domicilio: DomicilioCreate
    crear_usuario: bool = False
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


class ClienteCreateResponse(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str
    usuario_creado: bool
    username: str | None = None
    password_temporal: str | None = None
