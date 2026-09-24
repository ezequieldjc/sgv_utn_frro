from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class MascotaListItem(BaseModel):
    id: int
    nombre: str
    especie_id: int
    especie_nombre: str
    raza_id: int
    raza_nombre: str
    persona_id: int
    tutor_nombre: str
    tutor_apellido: str
    tutor_dni: str | None = None
    mascota_estado_id: int
    mascota_estado_nombre: str


class MascotaListResponse(BaseModel):
    items: list[MascotaListItem]
    total: int
    page: int
    page_size: int


class MascotaCreate(BaseModel):
    persona_id: int | None = None
    tutor_eventual: bool = False
    nombre: str = Field(min_length=1, max_length=50)
    especie_id: int
    raza_id: int
    sexo: Literal["M", "H", "U"] | None = None
    fecha_nacimiento: date | None = None
    peso_inicial_kg: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    microchip: str | None = Field(default=None, max_length=15)
    alertas_medicas: str | None = None

    @model_validator(mode="after")
    def tutor_o_eventual(self) -> MascotaCreate:
        if not self.tutor_eventual and self.persona_id is None:
            raise ValueError("Debe indicar un tutor o marcar tutor eventual")
        return self

    @field_validator("microchip")
    @classmethod
    def microchip_vacio_a_none(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        return value.strip()

    @field_validator("alertas_medicas")
    @classmethod
    def alertas_vacias_a_none(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        return value.strip()

    @field_validator("peso_inicial_kg")
    @classmethod
    def peso_positivo(cls, value: Decimal | None) -> Decimal | None:
        if value is not None and value <= 0:
            raise ValueError("El peso inicial debe ser mayor a 0")
        return value


class MascotaCreateResponse(BaseModel):
    id: int
    nombre: str
    persona_id: int
    raza_id: int
    mascota_estado_id: int
    peso_registrado: bool


class TutorOpcion(BaseModel):
    id: int
    nombre: str
    apellido: str
    dni: str | None = None


class EspecieOpcionMascota(BaseModel):
    id: int
    nombre: str


class RazaOpcionMascota(BaseModel):
    id: int
    nombre: str
    especie_id: int


class MascotaEstadoOpcion(BaseModel):
    id: int
    nombre: str


class CatalogoClinicoOpcion(BaseModel):
    id: int
    nombre: str
    especie_id: int | None = None


class MascotaDetail(BaseModel):
    id: int
    nombre: str
    especie_id: int
    especie_nombre: str
    raza_id: int
    raza_nombre: str
    persona_id: int
    tutor_nombre: str
    tutor_apellido: str
    tutor_dni: str | None = None
    mascota_estado_id: int
    mascota_estado_nombre: str
    sexo: Literal["M", "H", "U"] | None = None
    fecha_nacimiento: date | None = None
    microchip: str | None = None
    alertas_medicas: str | None = None
    pelaje_id: int | None = None
    tamanio_id: int | None = None
    habitat_id: int | None = None
    estado_reproductivo_id: int | None = None
    temperamento_id: int | None = None


class MascotaUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=50)
    persona_id: int | None = None
    raza_id: int | None = None
    mascota_estado_id: int | None = None
    sexo: Literal["M", "H", "U"] | None = None
    fecha_nacimiento: date | None = None
    microchip: str | None = Field(default=None, max_length=15)
    alertas_medicas: str | None = None
    pelaje_id: int | None = None
    tamanio_id: int | None = None
    habitat_id: int | None = None
    estado_reproductivo_id: int | None = None
    temperamento_id: int | None = None

    @field_validator("nombre")
    @classmethod
    def nombre_strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("El nombre no puede estar vacío")
        return stripped

    @field_validator("microchip")
    @classmethod
    def microchip_vacio_a_none_update(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        return value.strip()

    @field_validator("alertas_medicas")
    @classmethod
    def alertas_vacias_a_none_update(cls, value: str | None) -> str | None:
        if value is None or value.strip() == "":
            return None
        return value.strip()
