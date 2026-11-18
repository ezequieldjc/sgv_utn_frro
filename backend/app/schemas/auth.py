from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.common import validar_mail_cliente


class LoginRequest(BaseModel):
    # Usuario del empleado o mail del cliente (auth.usuario.username es varchar(100)).
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class CambiarContrasenaObligatorioRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password_actual: str = Field(min_length=1, max_length=128)
    password_nueva: str = Field(min_length=8, max_length=128)


class CambiarContrasenaObligatorioResponse(BaseModel):
    mensaje: str


class RegistroRequest(BaseModel):
    """Registro público de un cliente desde el login. Elige su contraseña acá mismo."""

    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=1, max_length=20)
    celular: str = Field(min_length=1, max_length=30)
    mail: str = Field(min_length=1, max_length=100)
    fecha_nacimiento: date | None = None
    sexo: Literal["M", "F", "X"] | None = None
    password: str = Field(min_length=8, max_length=128)
    password_repetida: str = Field(min_length=1, max_length=128)

    @field_validator("nombre", "apellido")
    @classmethod
    def texto_no_vacio(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Este campo es obligatorio")
        return value

    @field_validator("dni")
    @classmethod
    def dni_solo_digitos(cls, value: str) -> str:
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

    @field_validator("fecha_nacimiento")
    @classmethod
    def fecha_no_futura(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura")
        return value

    @model_validator(mode="after")
    def contrasenas_iguales(self) -> RegistroRequest:
        if self.password != self.password_repetida:
            raise ValueError("Las contraseñas no coinciden")
        return self


class RegistroResponse(BaseModel):
    mensaje: str
    username: str


class UsuarioSesion(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str


class AuthSessionResponse(BaseModel):
    usuario: UsuarioSesion
    permisos: list[str]

