from __future__ import annotations

from pydantic import BaseModel, Field


class RolListItem(BaseModel):
    id: int
    nombre: str = Field(min_length=1, max_length=50)
