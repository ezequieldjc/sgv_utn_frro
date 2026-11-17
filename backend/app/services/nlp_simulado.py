"""Extractor por reglas del dictado (NLP SIMULADO para el prototipo).

Convierte el texto de un dictado en la ficha del contrato 1.0 (`FichaDictado`): textos de la
consulta, peso, temperatura y signos con su código del catálogo, distinguiendo los negados
("no vomita") de los presentes. Es el "extractor por reglas" que `docs/flujo_de_los_datos.md`
prevé como respaldo de Claude: en el prototipo no hay audio ni modelo de lenguaje, el texto llega
escrito (o simulado por la pantalla) y se procesa acá, sin servicios externos.

Reglas que respeta (skill extraccion-ficha-clinica):
- Nunca inventa: lo que no se dictó queda en None.
- Peso y temperatura fuera de rango quedan en None; la frase queda en el texto del examen físico.
- Negado no es lo mismo que no mencionado: solo los signos nombrados generan entrada.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from app.schemas.consultas import FichaDictado, SignoDictado

VERSION_EXTRACTOR = "reglas-0.1"

# Formas de decir cada signo (normalizadas: minúsculas y sin tildes). Se buscan como inicio de
# palabra, así "vomit" cubre vomita, vomitó y vómitos. El nombre del catálogo se suma solo.
SINONIMOS: dict[str, tuple[str, ...]] = {
    "estertor_ronquido": ("ronca", "ronquido", "estertor"),
    "intolerancia_ejercicio": (
        "se cansa",
        "se agita",
        "intolerancia al ejercicio",
        "no aguanta caminar",
        "no aguanta el ejercicio",
    ),
    "disnea": (
        "disnea",
        "dificultad respiratoria",
        "dificultad para respirar",
        "respira con dificultad",
        "le cuesta respirar",
    ),
    "cianosis": ("cianosis", "cianotic", "azulad", "lengua morada"),
    "sincope": ("sincope", "desmay", "se desvanece"),
    "regurgitacion": ("regurgit", "devuelve la comida", "devuelve sin esfuerzo"),
    "tos": ("tos", "tose", "tosiendo"),
    "vomito": ("vomit",),
    "diarrea": ("diarrea", "heces blandas", "materia fecal blanda"),
    "decaimiento": ("decaid", "decaimiento", "letargic", "apatic", "desganad"),
    "inapetencia": (
        "inapetencia",
        "no come",
        "come poco",
        "poco apetito",
        "sin apetito",
        "falta de apetito",
        "anorexia",
    ),
    "fiebre": ("fiebre", "febril", "hipertermia"),
    "dolor_abdominal": (
        "dolor abdominal",
        "dolor a la palpacion abdominal",
        "abdomen doloroso",
        "dolor en el abdomen",
    ),
    "claudicacion": ("rengu", "claudica", "cojea", "cojera"),
    "dolor_cadera": (
        "dolor de cadera",
        "dolor en la cadera",
        "dolor a la manipulacion de la cadera",
        "dolor coxofemoral",
    ),
    "dificultad_levantarse": (
        "le cuesta levantarse",
        "dificultad para levantarse",
        "le cuesta pararse",
    ),
    "prurito": ("prurito", "picazon", "se rasca", "rascado", "comezon"),
    "lamido_patas": ("se lame las patas", "lamido de patas", "se chupa las patas"),
    "sacudida_cabeza": ("sacude la cabeza", "sacudida de cabeza", "sacude las orejas"),
    "secrecion_otica": (
        "secrecion otica",
        "secrecion en el oido",
        "secrecion en los oidos",
        "secrecion marron",
        "otorrea",
    ),
}

NEGACIONES = {"no", "sin", "nunca", "niega", "ni", "tampoco", "jamas"}
VENTANA_NEGACION = 4  # palabras hacia atrás, dentro de la misma frase

# Frases: se corta en puntos, punto y coma, comas, saltos de línea y "pero".
_CORTE_FRASES = re.compile(r"[.;,\n]+|\bpero\b", re.IGNORECASE)
_CORTE_ORACIONES = re.compile(r"(?<=[.;\n])\s+|\n+")

_NUM = r"(\d{1,3}(?:[.,]\d{1,2})?)"
_PESO_UNIDAD = re.compile(_NUM + r"\s*(?:kg|kgs|kilos?|kilogramos?)\b")
_PESO_PALABRA = re.compile(r"\bpes(?:a|o)\s*(?:de\s*)?" + _NUM)
_TEMP_PALABRA = re.compile(r"\btemperatura\s*(?:de\s*)?(?:es\s*)?" + _NUM)
_TEMP_UNIDAD = re.compile(_NUM + r"\s*(?:°|grados)")

_CLAVES_SECCION: list[tuple[str, tuple[str, ...]]] = [
    (
        "tratamiento",
        (
            "indico",
            "indicamos",
            "receto",
            "tratamiento",
            "administrar",
            "dieta",
            "reposo",
            "control en",
            "volver en",
            "cada ",
            "comprimido",
            "gotas",
            "mg",
        ),
    ),
    (
        "observaciones",
        (
            "pido",
            "solicito",
            "estudio",
            "radiografia",
            "ecografia",
            "analisis",
            "laboratorio",
            "citologia",
            "hemograma",
            "placa",
        ),
    ),
    (
        "examen_fisico",
        (
            "temperatura",
            "pesa",
            "peso",
            "kilos",
            "mucosas",
            "auscult",
            "palpacion",
            "frecuencia",
            "examen",
            "se observa",
            "presenta",
            "abdomen",
            "ganglios",
            "hidratacion",
            "llenado capilar",
            "soplo",
        ),
    ),
    (
        "anamnesis",
        (
            "dueno",
            "duena",
            "tutor",
            "tutora",
            "cuenta",
            "refiere",
            "comenta",
            "dice que",
            "desde hace",
            "desde ayer",
            "hace ",
            "antecedente",
        ),
    ),
]
_MOTIVO = re.compile(
    r"\b(?:viene|vino|consulta|consultan|lo traen|la traen|traen)\s+(?:por|porque)\s+(.+)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SintomaCatalogo:
    """Un signo del catálogo (`clinica.sintoma`) tal como lo necesita el extractor."""

    codigo: str
    nombre_es: str


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y con espacios simples (no cambia el resto del texto)."""
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", sin_tildes.lower()).strip()


def _a_decimal(valor: str) -> Decimal | None:
    try:
        return Decimal(valor.replace(",", "."))
    except InvalidOperation:
        return None


def extraer_peso(texto_normalizado: str) -> Decimal | None:
    for patron in (_PESO_UNIDAD, _PESO_PALABRA):
        match = patron.search(texto_normalizado)
        if match:
            peso = _a_decimal(match.group(1))
            if peso is not None and Decimal("0") < peso <= Decimal("150"):
                return peso.quantize(Decimal("0.01"))
            return None
    return None


def extraer_temperatura(texto_normalizado: str) -> Decimal | None:
    for patron in (_TEMP_PALABRA, _TEMP_UNIDAD):
        match = patron.search(texto_normalizado)
        if match:
            temperatura = _a_decimal(match.group(1))
            if temperatura is not None and Decimal("30") <= temperatura <= Decimal("45"):
                return temperatura.quantize(Decimal("0.1"))
            return None
    return None


def _formas_de_decir(catalogo: list[SintomaCatalogo]) -> list[tuple[str, str]]:
    """(forma normalizada, código), de la forma más larga a la más corta."""
    formas: list[tuple[str, str]] = []
    for sintoma in catalogo:
        for forma in (*SINONIMOS.get(sintoma.codigo, ()), normalizar(sintoma.nombre_es)):
            formas.append((normalizar(forma), sintoma.codigo))
    return sorted(set(formas), key=lambda item: -len(item[0]))


def _esta_negado(tramo_previo: str) -> bool:
    """¿Hay una negación en las últimas palabras antes del signo (sin cruzar otro signo)?"""
    palabras_previas = re.findall(r"[a-z]+", tramo_previo)
    return any(p in NEGACIONES for p in palabras_previas[-VENTANA_NEGACION:])


def extraer_signos(texto: str, catalogo: list[SintomaCatalogo]) -> list[SignoDictado]:
    """Un signo por código, con el fragmento tal como se dictó y si está presente o negado."""
    formas = _formas_de_decir(catalogo)
    signos: dict[str, SignoDictado] = {}
    for frase in _CORTE_FRASES.split(texto):
        frase_original = frase.strip()
        if not frase_original:
            continue
        frase_norm = normalizar(frase_original)

        # 1) Ubicar los signos de la frase: la forma más larga gana y no se pisan entre sí.
        encontrados: list[tuple[int, int, str, str]] = []
        for forma, codigo in formas:
            if codigo in signos or any(e[2] == codigo for e in encontrados):
                continue
            for match in re.finditer(r"\b" + re.escape(forma), frase_norm):
                inicio, fin = match.span()
                if any(inicio < e_fin and e_inicio < fin for e_inicio, e_fin, _, _ in encontrados):
                    continue
                encontrados.append((inicio, fin, codigo, forma))
                break

        # 2) Recorrerlos en orden: la negación vale desde el signo anterior hasta este.
        fin_anterior = 0
        for inicio, fin, codigo, forma in sorted(encontrados):
            forma_es_negativa = forma.split(" ", 1)[0] in NEGACIONES  # "no come", "sin apetito"
            negado = not forma_es_negativa and _esta_negado(frase_norm[fin_anterior:inicio])
            signos[codigo] = SignoDictado(
                codigo=codigo, texto_original=frase_original[:255], presente=not negado
            )
            fin_anterior = fin
    return list(signos.values())


def _seccion(oracion_normalizada: str) -> str | None:
    """Sección por palabras clave; None si la oración no tiene ninguna."""
    for seccion, claves in _CLAVES_SECCION:
        if any(clave in oracion_normalizada for clave in claves):
            return seccion
    return None


def _capitalizar(texto: str) -> str:
    return texto[:1].upper() + texto[1:]


def extraer_textos(texto: str) -> dict[str, str | None]:
    """Reparte el dictado en motivo, anamnesis, examen físico, tratamiento y observaciones."""
    oraciones = [o.strip() for o in _CORTE_ORACIONES.split(texto.strip()) if o.strip()]
    secciones: dict[str, list[str]] = {
        "motivo": [],
        "anamnesis": [],
        "examen_fisico": [],
        "tratamiento": [],
        "observaciones": [],
    }
    for posicion, oracion in enumerate(oraciones):
        seccion = _seccion(normalizar(oracion))
        if posicion == 0:
            match = _MOTIVO.search(oracion)
            if match:
                secciones["motivo"].append(_capitalizar(match.group(1).strip(" .;")))
                continue
            if seccion is None:
                # Sin "viene por...", la primera oración sin otra pista es el motivo.
                secciones["motivo"].append(_capitalizar(oracion.strip(" .;")))
                continue
        secciones[seccion or "anamnesis"].append(oracion)
    return {clave: (" ".join(valor) if valor else None) for clave, valor in secciones.items()}


def extraer_ficha(texto: str, catalogo: list[SintomaCatalogo]) -> FichaDictado:
    """Ficha del contrato 1.0 a partir del texto de un dictado."""
    texto_normalizado = normalizar(texto)
    textos = extraer_textos(texto)
    return FichaDictado(
        motivo=textos["motivo"],
        anamnesis=textos["anamnesis"],
        examen_fisico=textos["examen_fisico"],
        tratamiento=textos["tratamiento"],
        observaciones=textos["observaciones"],
        peso_kg=extraer_peso(texto_normalizado),
        temperatura_c=extraer_temperatura(texto_normalizado),
        signos=extraer_signos(texto, catalogo),
    )
