from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class CambiarContrasenaObligatorioRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password_actual: str = Field(min_length=1, max_length=128)
    password_nueva: str = Field(min_length=8, max_length=128)


class CambiarContrasenaObligatorioResponse(BaseModel):
    mensaje: str


class UsuarioSesion(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str


class AuthSessionResponse(BaseModel):
    usuario: UsuarioSesion
    permisos: list[str]

