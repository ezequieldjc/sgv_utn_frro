from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class UsuarioListItem(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str
    habilitado: bool
    rol_id: int
    rol_nombre: str
    ultimo_inicio_sesion: datetime | None = Field(default=None)
