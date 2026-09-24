from __future__ import annotations

from pydantic import BaseModel, Field


class PublicConfigResponse(BaseModel):
    razon_social: str


class ConfigItem(BaseModel):
    id: int
    config_id: int
    config_nombre: str
    parametro_id: int
    parametro_nombre: str
    parametro_valor: str = Field(min_length=1, max_length=255)


class ConfigValorUpdate(BaseModel):
    parametro_valor: str = Field(min_length=1, max_length=255)
