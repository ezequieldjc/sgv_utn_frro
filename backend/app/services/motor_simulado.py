"""Motor de apoyo al diagnóstico SIMULADO para el prototipo.

Aplica la fórmula de `docs/flujo_de_los_datos.md` (sección 3):

    puntaje(p) = prevalencia(p) × multiplicador de raza(p)
                 × frecuencia(p, s) de cada signo presente
                 × (1 − frecuencia(p, s)) de cada signo negado

y normaliza para que los puntajes sumen 100 %. En la normalización entra además la hipótesis
"otra causa no contemplada". El catálogo del prototipo tiene pocas patologías, y sin ese término el
motor repartiría siempre el 100 % entre ellas aunque ninguna explique los signos (un perro mestizo
que ronca y se agita terminaba con "displasia de cadera 81 %"). Su probabilidad base es lo que la
suma de las prevalencias deja afuera, con un piso, y cada signo presente la multiplica por 0,05
(el nivel "raro" de la escala) y cada negado por 0,95. Si esa hipótesis es la más probable, la
evidencia no alcanza para sugerir con confianza y la pantalla lo avisa.

Lo simulado es la base de conocimiento: en vez de
leer `patologia_sintoma` y `raza_patologia` (que todavía no existen en PostgreSQL), las
frecuencias y las predisposiciones de las patologías del prototipo están escritas acá, en
`BASE_CONOCIMIENTO`. La prevalencia y `solo_razas_predispuestas` sí salen de `clinica.patologia`.

Los módulos se pasan códigos (`sintoma.codigo`, `patologia.codigo`, `raza.codigo`), nunca ids.
El motor es determinístico: misma entrada, mismo resultado. No guarda nada.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

VERSION_MOTOR = "simulado-0.2"
# Frecuencia que se usa cuando la base no relaciona el signo con la patología.
FRECUENCIA_SIN_FILA = 0.02
# Hipótesis "otra causa no contemplada": con qué frecuencia mostraría cualquier signo un cuadro
# que no está en el catálogo (nivel "raro" de la escala), y el piso de su probabilidad base para
# que siga pesando aunque el catálogo crezca.
FRECUENCIA_OTRA_CAUSA = 0.05
PROBABILIDAD_OTRA_CAUSA_MINIMA = 0.10
TOP = 3


@dataclass(frozen=True)
class ConocimientoPatologia:
    """Lo que la base de conocimiento sabría de una patología."""

    frecuencias: dict[str, float]
    razas: dict[str, float] = field(default_factory=dict)
    estudio_sugerido: str | None = None


# Escala ordinal del documento: muy frecuente 0,8 · frecuente 0,5 · ocasional 0,2 · raro 0,05.
# Multiplicadores de raza: 4 (most_important), 2,5 (mayor incidencia / conformación).
BASE_CONOCIMIENTO: dict[str, ConocimientoPatologia] = {
    "brachycephalic-obstructive-airway-syndrome": ConocimientoPatologia(
        frecuencias={
            "estertor_ronquido": 0.8,
            "intolerancia_ejercicio": 0.8,
            "disnea": 0.5,
            "regurgitacion": 0.5,
            "cianosis": 0.2,
            "sincope": 0.2,
            "tos": 0.2,
        },
        razas={"french-bulldog": 4.0},
        estudio_sugerido="Evaluación de vías aéreas superiores y radiografía de tórax",
    ),
    "acute-gastroenteritis": ConocimientoPatologia(
        frecuencias={
            "vomito": 0.8,
            "diarrea": 0.8,
            "decaimiento": 0.5,
            "inapetencia": 0.5,
            "dolor_abdominal": 0.5,
            "fiebre": 0.2,
        },
        estudio_sugerido="Coproparasitológico y análisis de sangre",
    ),
    "hip-dysplasia": ConocimientoPatologia(
        frecuencias={
            "claudicacion": 0.8,
            "dolor_cadera": 0.8,
            "dificultad_levantarse": 0.5,
            "intolerancia_ejercicio": 0.5,
        },
        razas={"labrador-retriever": 2.5, "german-shepherd-dog": 4.0},
        estudio_sugerido="Radiografía de cadera",
    ),
    "otitis-externa": ConocimientoPatologia(
        frecuencias={
            "sacudida_cabeza": 0.8,
            "secrecion_otica": 0.8,
            "prurito": 0.5,
        },
        razas={"cocker-spaniel": 4.0, "poodle-standard": 2.5, "poodle-toy": 2.5},
        estudio_sugerido="Citología de oído",
    ),
    "atopic-dermatitis": ConocimientoPatologia(
        frecuencias={
            "prurito": 0.8,
            "lamido_patas": 0.5,
            "sacudida_cabeza": 0.2,
        },
        razas={"french-bulldog": 2.5, "labrador-retriever": 2.5},
        estudio_sugerido="Raspado cutáneo y descarte de alergia alimentaria",
    ),
}


@dataclass(frozen=True)
class PatologiaEntrada:
    """Una patología del catálogo (`clinica.patologia`)."""

    id: int
    codigo: str
    nombre: str
    prevalencia: float
    solo_razas_predispuestas: bool = False


@dataclass(frozen=True)
class SignoEntrada:
    """Un signo de la consulta con código. Los signos sin código no entran al motor."""

    codigo: str
    presente: bool


@dataclass(frozen=True)
class Sugerencia:
    patologia_id: int
    codigo: str
    nombre: str
    ranking: int
    probabilidad_pct: Decimal
    estudio_sugerido: str | None
    explicacion: dict[str, Any]


@dataclass(frozen=True)
class ResultadoMotor:
    """El top 3 de patologías y cuánto pesa una causa que el catálogo no contempla.

    `otra_causa_pct` es `None` cuando no hay signos (no hay nada que calcular).
    `evidencia_suficiente` es falso cuando "otra causa" es más probable que la primera sugerencia.
    """

    sugerencias: list[Sugerencia]
    otra_causa_pct: Decimal | None
    evidencia_suficiente: bool


def _redondear_pct(valor: float) -> Decimal:
    return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def probabilidad_otra_causa(patologias: list[PatologiaEntrada]) -> float:
    """Probabilidad base de que el cuadro no sea ninguna patología del catálogo.

    Es lo que la suma de las prevalencias deja afuera, con un piso para que la hipótesis siga
    pesando aunque el catálogo crezca.
    """
    cubierta = sum(p.prevalencia for p in patologias)
    return max(1.0 - cubierta, PROBABILIDAD_OTRA_CAUSA_MINIMA)


def diagnosticar(
    raza_codigo: str | None,
    signos: list[SignoEntrada],
    patologias: list[PatologiaEntrada],
) -> ResultadoMotor:
    """Devuelve el top 3 de patologías con su porcentaje y la explicación de cada factor.

    Los porcentajes se calculan sobre el total que incluye "otra causa no contemplada", así que
    las sugerencias pueden sumar menos de 100 %. Sin signos no hay evidencia para sugerir nada:
    devuelve un resultado vacío.
    """
    if not signos:
        return ResultadoMotor(sugerencias=[], otra_causa_pct=None, evidencia_suficiente=False)

    puntajes: list[tuple[PatologiaEntrada, float, dict[str, Any], str | None]] = []
    for patologia in patologias:
        conocimiento = BASE_CONOCIMIENTO.get(patologia.codigo, ConocimientoPatologia({}))
        multiplicador_raza = conocimiento.razas.get(raza_codigo or "", None)
        if patologia.solo_razas_predispuestas and multiplicador_raza is None:
            # Patologías de conformación (por ejemplo, braquicefálico): solo en razas predispuestas.
            continue

        puntaje = patologia.prevalencia * (multiplicador_raza or 1.0)
        presentes: list[dict[str, Any]] = []
        negados: list[dict[str, Any]] = []
        for signo in signos:
            frecuencia = conocimiento.frecuencias.get(signo.codigo)
            sin_fila = frecuencia is None
            valor = FRECUENCIA_SIN_FILA if sin_fila else float(frecuencia)
            detalle = {"codigo": signo.codigo, "frecuencia": valor, "sin_fila": sin_fila}
            if signo.presente:
                puntaje *= valor
                presentes.append(detalle)
            else:
                puntaje *= 1.0 - valor
                negados.append(detalle)

        explicacion: dict[str, Any] = {
            "prevalencia": patologia.prevalencia,
            "raza": (
                {"codigo": raza_codigo, "multiplicador": multiplicador_raza}
                if multiplicador_raza is not None
                else None
            ),
            "factores": [],
            "edad": None,
            "sintomas_presentes": presentes,
            "sintomas_negados": negados,
        }
        puntajes.append((patologia, puntaje, explicacion, conocimiento.estudio_sugerido))

    puntaje_otra = probabilidad_otra_causa(patologias)
    for signo in signos:
        puntaje_otra *= FRECUENCIA_OTRA_CAUSA if signo.presente else 1.0 - FRECUENCIA_OTRA_CAUSA

    # puntaje_otra siempre es positivo, así que el total nunca es cero.
    total = puntaje_otra + sum(p for _, p, _, _ in puntajes)
    otra_causa_pct = _redondear_pct(puntaje_otra / total * 100)

    ordenados = sorted(
        (item for item in puntajes if item[1] > 0),
        key=lambda item: (-item[1], item[0].codigo),
    )
    sugerencias = [
        Sugerencia(
            patologia_id=patologia.id,
            codigo=patologia.codigo,
            nombre=patologia.nombre,
            ranking=puesto,
            probabilidad_pct=_redondear_pct(puntaje / total * 100),
            estudio_sugerido=estudio,
            # Queda guardado con el diagnóstico aceptado: explica por qué el porcentaje era ese.
            explicacion={**explicacion, "otra_causa_pct": float(otra_causa_pct)},
        )
        for puesto, (patologia, puntaje, explicacion, estudio) in enumerate(
            ordenados[:TOP], start=1
        )
    ]
    return ResultadoMotor(
        sugerencias=sugerencias,
        otra_causa_pct=otra_causa_pct,
        evidencia_suficiente=bool(ordenados) and ordenados[0][1] > puntaje_otra,
    )
