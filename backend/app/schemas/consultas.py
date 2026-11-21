from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

EstadoConsulta = Literal["borrador", "firmada"]
TipoDiagnostico = Literal["principal", "secundario"]
OrigenDiagnostico = Literal["manual", "sugerido_ia"]


def _limpiar_texto(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = valor.strip()
    return limpio or None


# ---------------------------------------------------------------------------
# Contrato 1.0 de la ficha del NLP (claves provisorias; ver la skill extraccion-ficha-clinica)
# ---------------------------------------------------------------------------


class SignoDictado(BaseModel):
    codigo: str | None = Field(default=None, max_length=40)
    texto_original: str = Field(min_length=1, max_length=255)
    presente: bool = True


class FichaDictado(BaseModel):
    version: Literal["1.0"] = "1.0"
    motivo: str | None = None
    anamnesis: str | None = None
    examen_fisico: str | None = None
    tratamiento: str | None = None
    observaciones: str | None = None
    peso_kg: Decimal | None = Field(default=None, gt=0, le=150, max_digits=5, decimal_places=2)
    temperatura_c: Decimal | None = Field(
        default=None, ge=30, le=45, max_digits=4, decimal_places=1
    )
    signos: list[SignoDictado] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------


class ConsultaCreate(BaseModel):
    mascota_id: int
    turno_id: int | None = None
    # Para un control: la consulta anterior (firmada y de la misma mascota). Si no se indica y la
    # consulta se abre desde un turno de tipo Control, se vincula sola a la última firmada.
    consulta_padre_id: int | None = None


class ConsultaUpdate(BaseModel):
    """Solo se modifican los campos enviados; enviar null borra el valor."""

    # null desvincula la consulta anterior.
    consulta_padre_id: int | None = None
    motivo: str | None = None
    anamnesis: str | None = None
    examen_fisico: str | None = None
    tratamiento: str | None = None
    observaciones: str | None = None
    peso_kg: Decimal | None = Field(default=None, gt=0, le=150, max_digits=5, decimal_places=2)
    temperatura_c: Decimal | None = Field(
        default=None, ge=30, le=45, max_digits=4, decimal_places=1
    )

    @field_validator("motivo", "anamnesis", "examen_fisico", "tratamiento", "observaciones")
    @classmethod
    def _textos(cls, valor: str | None) -> str | None:
        return _limpiar_texto(valor)


class DictadoCreate(BaseModel):
    texto: str = Field(min_length=1, max_length=5000)
    duracion_audio_s: Decimal | None = Field(
        default=None, ge=0, max_digits=6, decimal_places=1
    )

    @field_validator("texto")
    @classmethod
    def _texto(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El dictado está vacío")
        return limpio


class SignoCreate(BaseModel):
    sintoma_id: int
    presente: bool = True


class SignoUpdate(BaseModel):
    sintoma_id: int | None = None
    presente: bool | None = None


class DiagnosticoFirma(BaseModel):
    origen: OrigenDiagnostico
    tipo_diagnostico: TipoDiagnostico
    patologia_id: int | None = None
    descripcion_libre: str | None = Field(default=None, max_length=255)

    @field_validator("descripcion_libre")
    @classmethod
    def _descripcion(cls, valor: str | None) -> str | None:
        return _limpiar_texto(valor)

    @model_validator(mode="after")
    def _contenido(self) -> "DiagnosticoFirma":
        if self.origen == "sugerido_ia" and self.patologia_id is None:
            raise ValueError("Una sugerencia de la IA necesita la patología")
        if self.patologia_id is None and self.descripcion_libre is None:
            raise ValueError("El diagnóstico necesita una patología o una descripción")
        return self


class ConsultaFirmar(BaseModel):
    diagnosticos: list[DiagnosticoFirma] = Field(min_length=1)

    @model_validator(mode="after")
    def _un_principal(self) -> "ConsultaFirmar":
        principales = [d for d in self.diagnosticos if d.tipo_diagnostico == "principal"]
        if len(principales) != 1:
            raise ValueError("Tiene que haber exactamente un diagnóstico principal")
        return self


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------


class MascotaResumen(BaseModel):
    id: int
    nombre: str
    especie_nombre: str
    raza_nombre: str
    raza_codigo: str | None = None
    sexo: str | None = None
    fecha_nacimiento: date | None = None
    edad_meses: int | None = None
    ultimo_peso: Decimal | None = None
    estado_reproductivo_nombre: str | None = None
    alertas_medicas: str | None = None
    tutor_nombre: str


class ConsultaSignoItem(BaseModel):
    id: int
    sintoma_id: int | None = None
    codigo: str | None = None
    nombre: str | None = None
    sistema: str | None = None
    texto_original: str
    presente: bool
    origen: str
    confirmado: bool
    dictado_id: int | None = None


class DiagnosticoItem(BaseModel):
    id: int
    patologia_id: int | None = None
    patologia_codigo: str | None = None
    patologia_nombre: str | None = None
    descripcion_libre: str | None = None
    tipo_diagnostico: TipoDiagnostico
    origen: OrigenDiagnostico
    ranking: int | None = None
    probabilidad_pct: Decimal | None = None


class DictadoItem(BaseModel):
    id: int
    transcripcion: str
    modelo_stt: str
    modelo_llm: str | None = None
    version_prompt: str | None = None
    fecha_creacion: datetime


class ConsultaAnteriorResumen(BaseModel):
    """La consulta de la que esta es control, con lo necesario para comparar la evolución."""

    id: int
    fecha_hora: datetime
    fecha_firma: datetime | None = None
    veterinario_nombre: str
    motivo: str | None = None
    peso_kg: Decimal | None = None
    temperatura_c: Decimal | None = None
    tratamiento: str | None = None
    observaciones: str | None = None
    diagnosticos: list[DiagnosticoItem]
    signos: list[ConsultaSignoItem]


class ControlResumen(BaseModel):
    """Una consulta que se cargó como control de esta."""

    id: int
    fecha_hora: datetime
    estado: EstadoConsulta
    motivo: str | None = None
    diagnostico_principal: str | None = None


class ConsultaDetalle(BaseModel):
    id: int
    estado: EstadoConsulta
    fecha_hora: datetime
    fecha_firma: datetime | None = None
    turno_id: int | None = None
    veterinario_id: int
    veterinario_nombre: str
    motivo: str | None = None
    anamnesis: str | None = None
    examen_fisico: str | None = None
    peso_kg: Decimal | None = None
    temperatura_c: Decimal | None = None
    tratamiento: str | None = None
    observaciones: str | None = None
    mascota: MascotaResumen
    signos: list[ConsultaSignoItem]
    diagnosticos: list[DiagnosticoItem]
    dictados: list[DictadoItem]
    # Si es un control: la consulta anterior. Y si otras consultas son control de esta, cuáles.
    consulta_padre: ConsultaAnteriorResumen | None = None
    controles: list[ControlResumen] = Field(default_factory=list)


class SugerenciaItem(BaseModel):
    patologia_id: int
    codigo: str
    nombre: str
    ranking: int
    probabilidad_pct: Decimal
    estudio_sugerido: str | None = None
    explicacion: dict[str, Any]


class SugerenciasResponse(BaseModel):
    version_motor: str
    sugerencias: list[SugerenciaItem]
    signos_sin_codigo: int
    # Peso de "otra causa no contemplada" en el mismo total que los porcentajes de arriba.
    # None cuando no hay signos.
    otra_causa_pct: Decimal | None = None
    # Falso cuando "otra causa" es más probable que la primera sugerencia.
    evidencia_suficiente: bool = False


class ConsultaListItem(BaseModel):
    id: int
    estado: EstadoConsulta
    fecha_hora: datetime
    fecha_firma: datetime | None = None
    mascota_id: int
    mascota_nombre: str
    motivo: str | None = None
    diagnostico_principal: str | None = None
    veterinario_nombre: str
    consulta_padre_id: int | None = None


class ConsultaListResponse(BaseModel):
    items: list[ConsultaListItem]
    total: int


class SintomaOpcion(BaseModel):
    id: int
    codigo: str
    nombre_es: str
    sistema: str
    tipo: str


class PatologiaOpcion(BaseModel):
    id: int
    codigo: str
    nombre: str
