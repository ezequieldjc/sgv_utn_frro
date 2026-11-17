"""Respuestas del portal del cliente (solo lectura).

Son schemas propios, con lista blanca de campos: el portal nunca reutiliza los del lado
veterinario (`ConsultaDetalle`, `MascotaDetail`, `VentaDetail`). Así, si esos crecen, al cliente
no se le filtra nada. Lo que el cliente NO ve de una consulta: dictado, signos, porcentajes,
ranking, explicación y origen (IA o manual) de los diagnósticos, anamnesis, examen físico y
observaciones. Tampoco ve borradores.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class PortalMascota(BaseModel):
    id: int
    nombre: str
    especie_nombre: str
    raza_nombre: str
    sexo: str | None = None
    fecha_nacimiento: date | None = None
    edad_meses: int | None = None
    ultimo_peso: Decimal | None = None
    estado_nombre: str
    alertas_medicas: str | None = None


class PortalConsultaItem(BaseModel):
    id: int
    fecha_hora: datetime
    veterinario_nombre: str
    motivo: str | None = None
    diagnostico_principal: str | None = None
    es_control: bool = False


class PortalDiagnostico(BaseModel):
    nombre: str
    principal: bool


class PortalConsultaReferencia(BaseModel):
    """La consulta anterior de la que esta es control (solo para enlazarla)."""

    id: int
    fecha_hora: datetime


class PortalConsultaDetalle(BaseModel):
    id: int
    fecha_hora: datetime
    veterinario_nombre: str
    mascota_id: int
    mascota_nombre: str
    motivo: str | None = None
    peso_kg: Decimal | None = None
    temperatura_c: Decimal | None = None
    tratamiento: str | None = None
    diagnosticos: list[PortalDiagnostico]
    control_de: PortalConsultaReferencia | None = None


class PortalTurno(BaseModel):
    id: int
    mascota_id: int
    mascota_nombre: str
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime
    tipo_turno_nombre: str
    veterinario_nombre: str
    estado: str
    # El cliente solo cancela un turno futuro que siga solicitado; uno confirmado, llamando.
    cancelable: bool = False


class PortalTurnosResponse(BaseModel):
    proximos: list[PortalTurno]
    anteriores: list[PortalTurno]


class PortalOpcion(BaseModel):
    id: int
    nombre: str


class PortalTipoTurno(BaseModel):
    id: int
    nombre: str
    duracion_min: int


class PortalTurnoOpciones(BaseModel):
    """Lo que el cliente puede elegir al pedir un turno."""

    mascotas: list[PortalOpcion]
    tipos: list[PortalTipoTurno]
    veterinarios: list[PortalOpcion]
    # Primer día que se puede pedir: mañana. Los turnos para hoy se piden a la clínica.
    primer_dia: date


class PortalHorario(BaseModel):
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime


class PortalDisponibilidad(BaseModel):
    """Solo los horarios libres: el portal no dice por qué un horario está ocupado."""

    fecha: date
    horarios: list[PortalHorario]


class PortalTurnoCreate(BaseModel):
    mascota_id: int
    veterinario_id: int
    tipo_turno_id: int
    fecha_hora_inicio: datetime


class PortalCompraItem(BaseModel):
    id: int
    fecha: datetime
    total: Decimal
    medio_pago: str
    cantidad_items: int


class PortalCompraRenglon(BaseModel):
    producto_nombre: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal


class PortalCompraDetalle(BaseModel):
    id: int
    fecha: datetime
    total: Decimal
    medio_pago: str
    items: list[PortalCompraRenglon]
