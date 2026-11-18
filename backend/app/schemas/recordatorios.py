from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, model_validator

from app.schemas.vacunas import TipoPreventivo

TipoRecordatorio = Literal["turno", "dosis"]


class ContactoTutor(BaseModel):
    persona_id: int
    nombre: str
    celular: str
    # Número en formato internacional para wa.me (por ejemplo 5493406419004).
    whatsapp: str | None = None
    # Por qué no se puede enviar (celular que no se reconoce, tutor eventual...).
    motivo_sin_whatsapp: str | None = None


class UltimoEnvio(BaseModel):
    fecha_envio: datetime
    usuario_nombre: str
    destino: str


class RecordatorioTurno(BaseModel):
    turno_id: int
    fecha_hora_inicio: datetime
    estado_turno: str
    tipo_turno: str
    veterinario_nombre: str
    mascota_id: int
    mascota_nombre: str
    tutor: ContactoTutor
    mensaje: str
    url_whatsapp: str | None = None
    envios: int = 0
    ultimo_envio: UltimoEnvio | None = None


class RecordatorioDosis(BaseModel):
    tratamiento_preventivo_id: int
    tipo: TipoPreventivo
    nombre_producto: str
    fecha_aplicacion: date
    fecha_proxima_dosis: date
    # Negativo: vencida hace tantos días.
    dias_para_vencer: int
    mascota_id: int
    mascota_nombre: str
    tutor: ContactoTutor
    mensaje: str
    url_whatsapp: str | None = None
    envios: int = 0
    ultimo_envio: UltimoEnvio | None = None


class RecordatoriosResponse(BaseModel):
    hoy: date
    fecha_turnos: date
    dias_aviso_dosis: int
    dias_aviso_dosis_vencida: int
    turnos: list[RecordatorioTurno]
    dosis: list[RecordatorioDosis]


class RecordatorioCreate(BaseModel):
    turno_id: int | None = None
    tratamiento_preventivo_id: int | None = None

    @model_validator(mode="after")
    def _un_origen(self) -> "RecordatorioCreate":
        if (self.turno_id is None) == (self.tratamiento_preventivo_id is None):
            raise ValueError("Indicá el turno o la dosis del recordatorio (uno de los dos)")
        return self


class RecordatorioEnviado(BaseModel):
    id: int
    tipo: TipoRecordatorio
    fecha_envio: datetime
    destino: str
    mensaje: str
    url_whatsapp: str
    usuario_nombre: str
