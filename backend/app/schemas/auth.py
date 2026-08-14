from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class UsuarioSesion(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str


class AuthSessionResponse(BaseModel):
    usuario: UsuarioSesion
    permisos: list[str]

