from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.ventas import MedioPago

TipoPreventivo = Literal["vacunacion", "desparasitacion"]
# aplicar: se aplica hoy en la clínica con un producto del stock (descuenta stock y puede cobrarse).
# anterior: dosis que ya se dio (libreta sanitaria, otra veterinaria); solo queda registrada.
ModoRegistro = Literal["aplicar", "anterior"]
# sin_refuerzo: no tiene próxima dosis · reforzada: ya se aplicó el refuerzo
# al_dia / por_vencer / vencida: según cuánto falta para la próxima dosis.
EstadoDosis = Literal["sin_refuerzo", "reforzada", "al_dia", "por_vencer", "vencida"]


def _limpiar(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = valor.strip()
    return limpio or None


class TratamientoPreventivoCreate(BaseModel):
    mascota_id: int
    tipo: TipoPreventivo
    modo: ModoRegistro
    producto_id: int | None = None
    nombre_producto: str | None = Field(default=None, max_length=100)
    fecha_aplicacion: date | None = None
    fecha_proxima_dosis: date | None = None
    lote: str | None = Field(default=None, max_length=50)
    peso_kg: Decimal | None = Field(default=None, gt=0, le=150, max_digits=5, decimal_places=2)
    refuerzo_de_id: int | None = None
    cobrar: bool = False
    medio_pago: MedioPago | None = None
    consulta_id: int | None = None
    turno_id: int | None = None
    observaciones: str | None = Field(default=None, max_length=255)

    _limpiar_textos = field_validator("nombre_producto", "lote", "observaciones")(_limpiar)

    @model_validator(mode="after")
    def _coherencia(self) -> "TratamientoPreventivoCreate":
        if self.modo == "aplicar":
            if self.producto_id is None:
                raise ValueError("Para aplicar en la clínica hay que elegir el producto del stock")
        else:
            if not self.nombre_producto:
                raise ValueError("Para registrar una dosis anterior hay que indicar el producto")
            if self.fecha_aplicacion is None:
                raise ValueError("Para registrar una dosis anterior hay que indicar la fecha")
            if self.producto_id is not None or self.cobrar:
                raise ValueError("Una dosis anterior no descuenta stock ni se cobra")
            if self.turno_id is not None:
                raise ValueError("Una dosis anterior no se registra desde un turno")
        if self.cobrar and self.medio_pago is None:
            raise ValueError("Para cobrar hay que indicar el medio de pago")
        return self


class TratamientoPreventivoItem(BaseModel):
    id: int
    mascota_id: int
    tipo: TipoPreventivo
    producto_id: int | None = None
    nombre_producto: str
    aplicada_en_clinica: bool
    fecha_aplicacion: date
    fecha_proxima_dosis: date | None = None
    estado_dosis: EstadoDosis
    # Días hasta la próxima dosis (negativo: vencida hace tantos días). None sin próxima dosis.
    dias_para_vencer: int | None = None
    lote: str | None = None
    peso_kg: Decimal | None = None
    refuerzo_de_id: int | None = None
    reforzada_por_id: int | None = None
    consulta_id: int | None = None
    turno_id: int | None = None
    venta_id: int | None = None
    usuario_nombre: str
    observaciones: str | None = None
    fecha_registro: datetime


class MascotaPreventivaResumen(BaseModel):
    id: int
    nombre: str
    especie_nombre: str
    raza_nombre: str
    tutor_id: int
    tutor_nombre: str
    ultimo_peso: Decimal | None = None
    estado_nombre: str
    # Si puede recibir una aplicación nueva (activa o del tutor eventual en un estado permitido).
    atendible: bool


class PreventivaConfig(BaseModel):
    dias_refuerzo_vacuna: int
    dias_refuerzo_desparasitacion: int
    dias_aviso_dosis: int
    dias_aviso_dosis_vencida: int


class VacunasMascotaResponse(BaseModel):
    hoy: date
    mascota: MascotaPreventivaResumen
    items: list[TratamientoPreventivoItem]
    config: PreventivaConfig


class ProductoPreventivoOpcion(BaseModel):
    id: int
    nombre: str
    tipo: TipoPreventivo
    rubro_nombre: str
    unidad: str
    envases_cerrados: int
    precio_venta: Decimal | None = None


class TratamientoPreventivoResultado(BaseModel):
    item: TratamientoPreventivoItem
    venta_id: int | None = None
    venta_total: Decimal | None = None
    turno_atendido: bool = False
    advertencias: list[str] = Field(default_factory=list)
