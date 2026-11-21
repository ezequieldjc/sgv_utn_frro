from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class RecetaListItem(BaseModel):
    """En el prototipo la receta sale de las indicaciones (`tratamiento`) de la consulta firmada."""

    consulta_id: int
    fecha_firma: datetime
    mascota_id: int
    mascota_nombre: str
    tutor_nombre: str
    veterinario_nombre: str
    diagnostico_principal: str | None = None
    indicaciones: str


class RecetaListResponse(BaseModel):
    items: list[RecetaListItem]
    total: int
    page: int
    page_size: int
