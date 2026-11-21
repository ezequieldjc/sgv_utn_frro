from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import validar_mail_cliente
from app.schemas.usuarios import DomicilioCreate, DomicilioDetalle


class ClienteListItem(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str | None = None
    sexo: str | None = None
    celular: str
    fecha_alta: datetime
    ciudad: str | None = Field(default=None)
    edad: int | None = None


class ClienteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str | None = Field(default=None, max_length=20)
    fecha_nacimiento: date | None = None
    sexo: Literal["M", "F", "X"] | None = None
    celular: str = Field(min_length=1, max_length=30)
    # Obligatorio: es el usuario del cliente para entrar al portal (se guarda en minúsculas).
    mail: str = Field(min_length=1, max_length=100)
    domicilio: DomicilioCreate | None = None

    @field_validator("dni")
    @classmethod
    def dni_solo_digitos(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        value = value.strip()
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
    def mail_formato(cls, value: str) -> str:
        return validar_mail_cliente(value)


class ClienteCreateResponse(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str | None = None
    username: str
    password_temporal: str


class ClienteCuenta(BaseModel):
    """El usuario CLIENTE de la persona: su usuario es el mail."""

    usuario_id: int
    username: str
    habilitado: bool


class ClienteDetail(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str | None = None
    sexo: str | None = None
    fecha_nacimiento: date | None = None
    celular: str
    mail: str | None = None
    fecha_alta: datetime
    domicilio: DomicilioDetalle | None = None
    # None solo para el tutor eventual (o clientes viejos que no se migraron).
    cuenta: ClienteCuenta | None = None


class ClienteUpdate(BaseModel):
    """Edición desde Clientes → Editar. El mail es obligatorio si el cliente tiene cuenta (lo
    controla el servicio): el tutor eventual no tiene."""

    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str | None = Field(default=None, max_length=20)
    fecha_nacimiento: date | None = None
    sexo: Literal["M", "F", "X"] | None = None
    celular: str = Field(min_length=1, max_length=30)
    mail: str | None = Field(default=None, max_length=100)
    domicilio: DomicilioCreate | None = None

    @field_validator("dni")
    @classmethod
    def dni_solo_digitos(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        value = value.strip()
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
        return validar_mail_cliente(value)

