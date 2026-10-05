from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, model_validator

EstadoTurno = Literal["solicitado", "confirmado", "realizado", "cancelado", "no_asistio"]
CanalOrigen = Literal["mostrador", "telefono", "whatsapp", "portal"]
# "portal" lo asigna el portal del propietario; desde la app interna no se elige.
CanalOrigenInterno = Literal["mostrador", "telefono", "whatsapp"]


class TurnoCreate(BaseModel):
    """Alta de turno. Si `fecha_hora_inicio` viene sin zona horaria, se interpreta
    en la hora local de la clínica (sys.config AGENDA / ZONA_HORARIA)."""

    mascota_id: int
    veterinario_id: int
    tipo_turno_id: int
    fecha_hora_inicio: datetime
    canal_origen: CanalOrigenInterno = "mostrador"
    estado_inicial: Literal["solicitado", "confirmado"] = "solicitado"


class TurnoReprogramar(BaseModel):
    fecha_hora_inicio: datetime | None = None
    veterinario_id: int | None = None
    tipo_turno_id: int | None = None

    @model_validator(mode="after")
    def al_menos_un_campo(self) -> TurnoReprogramar:
        if (
            self.fecha_hora_inicio is None
            and self.veterinario_id is None
            and self.tipo_turno_id is None
        ):
            raise ValueError("Debe indicar al menos un dato a modificar")
        return self


class TurnoCambioEstado(BaseModel):
    estado: Literal["confirmado", "realizado", "no_asistio"]


class TurnoItem(BaseModel):
    id: int
    mascota_id: int
    mascota_nombre: str
    tutor_id: int
    tutor_nombre: str
    tutor_apellido: str
    tutor_celular: str | None = None
    veterinario_id: int
    veterinario_nombre: str
    veterinario_apellido: str
    tipo_turno_id: int
    tipo_turno_nombre: str
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    estado: EstadoTurno
    canal_origen: CanalOrigen


class TurnoListResponse(BaseModel):
    items: list[TurnoItem]


class VeterinarioOpcion(BaseModel):
    id: int
    username: str
    nombre: str
    apellido: str


class TipoTurnoOpcion(BaseModel):
    id: int
    nombre: str
    duracion_min: int


class MascotaAgendaOpcion(BaseModel):
    id: int
    nombre: str
    especie_nombre: str
    raza_nombre: str
    tutor_id: int
    tutor_nombre: str
    tutor_apellido: str
    tutor_dni: str | None = None


class FranjaHoraria(BaseModel):
    desde: str
    hasta: str


class HorarioDia(BaseModel):
    dia_semana: int  # 0 = lunes ... 6 = domingo
    franjas: list[FranjaHoraria]


class HorarioAtencion(BaseModel):
    zona_horaria: str
    duracion_modulo_min: int
    dias: list[HorarioDia]


class FranjaDisponible(BaseModel):
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime


class DisponibilidadResponse(BaseModel):
    fecha: date
    veterinario_id: int
    tipo_turno_id: int
    duracion_min: int
    franjas: list[FranjaDisponible]
