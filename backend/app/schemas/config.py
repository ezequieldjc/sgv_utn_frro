from __future__ import annotations

from pydantic import BaseModel


class PublicConfigResponse(BaseModel):
    razon_social: str

