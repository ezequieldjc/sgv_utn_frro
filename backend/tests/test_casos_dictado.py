"""Los casos de `docs/casos_prueba_dictado.md`, como tests.

Cada caso pasa el texto por el extractor por reglas y el resultado por el motor simulado, y
verifica qué signos salen presentes y negados, cuál es la primera sugerencia y si la evidencia
alcanza. Son funciones puras: no tocan la base. Si alguien cambia los sinónimos, las negaciones o
la base de conocimiento y uno de estos casos cambia, el test lo avisa y el documento hay que
actualizarlo.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.services import motor_simulado, nlp_simulado

# Mismo catálogo que carga scripts/clinica/006_datos_prototipo.sql.
CATALOGO = [
    nlp_simulado.SintomaCatalogo(codigo, nombre)
    for codigo, nombre in [
        ("estertor_ronquido", "Ronquido / estertor"),
        ("intolerancia_ejercicio", "Intolerancia al ejercicio"),
        ("disnea", "Dificultad respiratoria"),
        ("cianosis", "Cianosis"),
        ("sincope", "Síncope (desmayo)"),
        ("regurgitacion", "Regurgitación"),
        ("tos", "Tos"),
        ("vomito", "Vómitos"),
        ("diarrea", "Diarrea"),
        ("decaimiento", "Decaimiento"),
        ("inapetencia", "Inapetencia"),
        ("fiebre", "Fiebre"),
        ("dolor_abdominal", "Dolor abdominal"),
        ("claudicacion", "Claudicación (renguera)"),
        ("dolor_cadera", "Dolor de cadera"),
        ("dificultad_levantarse", "Dificultad para levantarse"),
        ("prurito", "Prurito (picazón)"),
        ("lamido_patas", "Lamido de patas"),
        ("sacudida_cabeza", "Sacudida de cabeza"),
        ("secrecion_otica", "Secreción en el oído"),
    ]
]
PATOLOGIAS = [
    motor_simulado.PatologiaEntrada(
        1, "brachycephalic-obstructive-airway-syndrome", "Síndrome braquicefálico", 0.01, True
    ),
    motor_simulado.PatologiaEntrada(2, "acute-gastroenteritis", "Gastroenteritis aguda", 0.05),
    motor_simulado.PatologiaEntrada(3, "hip-dysplasia", "Displasia de cadera", 0.02),
    motor_simulado.PatologiaEntrada(4, "otitis-externa", "Otitis externa", 0.04),
    motor_simulado.PatologiaEntrada(5, "atopic-dermatitis", "Dermatitis atópica", 0.03),
]


@dataclass(frozen=True)
class Caso:
    raza: str | None
    texto: str
    presentes: frozenset[str]
    negados: frozenset[str]
    primera: str
    evidencia_suficiente: bool


CASOS = {
    "1-thor-displasia": Caso(
        raza="labrador-retriever",
        texto=(
            "Viene porque renguea de atrás desde hace un mes y le cuesta levantarse después de "
            "dormir. No tose ni vomita. Pesa 35 kilos, temperatura 38,6. Dolor a la manipulación "
            "de la cadera. Indico antiinflamatorio, bajar de peso y radiografía de cadera."
        ),
        presentes=frozenset({"claudicacion", "dificultad_levantarse", "dolor_cadera"}),
        negados=frozenset({"tos", "vomito"}),
        primera="hip-dysplasia",
        evidencia_suficiente=True,
    ),
    "2-mora-displasia": Caso(
        raza="german-shepherd-dog",
        texto=(
            "Viene porque le cuesta pararse y cojea de las patas traseras. La dueña dice que no "
            "está decaída. Pesa 29,5 kilos, temperatura 38,4. Dolor en la cadera al extender los "
            "miembros. Indico radiografía de cadera y control en dos semanas."
        ),
        presentes=frozenset({"claudicacion", "dificultad_levantarse", "dolor_cadera"}),
        negados=frozenset({"decaimiento"}),
        primera="hip-dysplasia",
        evidencia_suficiente=True,
    ),
    "3-lola-otitis": Caso(
        raza="poodle-toy",
        texto=(
            "Viene porque sacude la cabeza todo el tiempo y se rasca las orejas. No tiene fiebre. "
            "Pesa 3,1 kilos, temperatura 38,7. Secreción marrón en el oído derecho. Indico "
            "limpieza ótica y gotas por siete días."
        ),
        presentes=frozenset({"sacudida_cabeza", "prurito", "secrecion_otica"}),
        negados=frozenset({"fiebre"}),
        primera="otitis-externa",
        evidencia_suficiente=True,
    ),
    "4-kiki-gastroenteritis": Caso(
        raza=None,
        texto=(
            "Viene porque vomitó tres veces desde ayer y tiene diarrea. Está decaída y no come. "
            "Pesa 9 kilos, temperatura 39,6. Dolor abdominal a la palpación. Indico dieta blanda, "
            "hidratación y control en 48 horas."
        ),
        presentes=frozenset(
            {"vomito", "diarrea", "decaimiento", "inapetencia", "dolor_abdominal"}
        ),
        negados=frozenset(),
        primera="acute-gastroenteritis",
        evidencia_suficiente=True,
    ),
    "5-bela-dermatitis": Caso(
        raza=None,  # Beagle: sin código en el prototipo
        texto=(
            "Viene porque se rasca todo el día y se lame las patas. No sacude la cabeza. Pesa 2,4 "
            "kilos, temperatura 38,5. No hay secreción en los oídos. Indico baño medicado y "
            "control en tres semanas."
        ),
        presentes=frozenset({"prurito", "lamido_patas"}),
        negados=frozenset({"sacudida_cabeza", "secrecion_otica"}),
        primera="atopic-dermatitis",
        evidencia_suficiente=True,
    ),
    "6-thor-dermatitis": Caso(
        raza="labrador-retriever",
        texto=(
            "Viene porque tiene mucha picazón y se chupa las patas, sobre todo en primavera. No "
            "renguea. Pesa 34 kilos, temperatura 38,5. Indico baño medicado y control en tres "
            "semanas."
        ),
        presentes=frozenset({"prurito", "lamido_patas"}),
        negados=frozenset({"claudicacion"}),
        primera="atopic-dermatitis",
        evidencia_suficiente=True,
    ),
    "7-coco-control": Caso(
        raza="french-bulldog",
        texto=(
            "Viene a control. Sigue roncando de noche pero ya no se cansa al caminar y no tose. "
            "Pesa 13 kilos, temperatura 38,6. Indico seguir con reposo relativo y evitar el calor."
        ),
        presentes=frozenset({"estertor_ronquido"}),
        negados=frozenset({"intolerancia_ejercicio", "tos"}),
        primera="brachycephalic-obstructive-airway-syndrome",
        # Un solo signo presente: el braquicefálico encabeza, pero no alcanza para sugerir.
        evidencia_suficiente=False,
    ),
    "8-lola-gastroenteritis-leve": Caso(
        raza="poodle-toy",
        texto=(
            "Viene porque tiene diarrea desde hace dos días. No vomitó y no tiene fiebre, pero "
            "come poco. Pesa 3 kilos, temperatura 38,9. Indico dieta blanda y probióticos."
        ),
        presentes=frozenset({"diarrea", "inapetencia"}),
        negados=frozenset({"vomito", "fiebre"}),
        primera="acute-gastroenteritis",
        evidencia_suficiente=True,
    ),
    "9-mora-dos-problemas": Caso(
        raza="german-shepherd-dog",
        texto=(
            "Viene porque cojea de la pata trasera izquierda y además vomitó dos veces anoche. "
            "Está decaída. Pesa 29 kilos, temperatura 38,8. Indico radiografía y análisis de "
            "sangre."
        ),
        presentes=frozenset({"claudicacion", "vomito", "decaimiento"}),
        negados=frozenset(),
        primera="acute-gastroenteritis",
        evidencia_suficiente=True,
    ),
    "10-kiki-caso-trampa": Caso(
        raza=None,
        texto=(
            "Viene porque ronca mucho y se agita al caminar. Pesa 9 kilos, temperatura 38,5. "
            "Indico control y estudios."
        ),
        presentes=frozenset({"estertor_ronquido", "intolerancia_ejercicio"}),
        negados=frozenset(),
        primera="hip-dysplasia",
        # Antes de simulado-0.2 daba "displasia de cadera 81 %".
        evidencia_suficiente=False,
    ),
    "11-felipe-dermatitis-shar-pei": Caso(
        raza="chinese-shar-pei",
        texto=(
            "Viene porque se rasca todo el día y se lame las patas desde hace un mes. "
            "El dueño cuenta que empeora en primavera, que no vomita ni tiene diarrea y que come "
            "bien. Pesa 21,5 kilos, temperatura 38,7. Presenta enrojecimiento en los pliegues de "
            "la cara, en las axilas y entre los dedos. No sacude la cabeza. Pido raspado cutáneo. "
            "Indico baño con clorhexidina cada tres días, oclacitinib 16 mg un comprimido cada 12 "
            "horas por 14 días y control en quince días."
        ),
        presentes=frozenset({"prurito", "lamido_patas"}),
        negados=frozenset({"vomito", "diarrea", "sacudida_cabeza"}),
        primera="atopic-dermatitis",
        evidencia_suficiente=True,
    ),
    "12-simon-otitis-shar-pei": Caso(
        raza="chinese-shar-pei",
        texto=(
            "Viene porque sacude la cabeza y tiene mal olor en las orejas desde hace cinco días. "
            "El dueño cuenta que se rasca las orejas de noche y que no tiene fiebre. Pesa 23,8 "
            "kilos, temperatura 38,5. Presenta el conducto auditivo derecho estrecho y enrojecido, "
            "con secreción marrón. Pido citología de oído. Indico limpiador ótico cada 12 horas, "
            "gotas de gentamicina con betametasona cinco gotas cada 12 horas por diez días y "
            "control en diez días."
        ),
        presentes=frozenset({"sacudida_cabeza", "prurito", "secrecion_otica"}),
        negados=frozenset({"fiebre"}),
        primera="otitis-externa",
        evidencia_suficiente=True,
    ),
}


def _correr(caso: Caso) -> tuple[nlp_simulado.FichaDictado, motor_simulado.ResultadoMotor]:
    ficha = nlp_simulado.extraer_ficha(caso.texto, CATALOGO)
    signos = [
        motor_simulado.SignoEntrada(codigo=s.codigo, presente=s.presente)
        for s in ficha.signos
        if s.codigo
    ]
    return ficha, motor_simulado.diagnosticar(caso.raza, signos, PATOLOGIAS)


@pytest.mark.parametrize("caso", list(CASOS.values()), ids=list(CASOS))
def test_caso_de_dictado(caso: Caso) -> None:
    ficha, resultado = _correr(caso)

    presentes = {s.codigo for s in ficha.signos if s.presente}
    negados = {s.codigo for s in ficha.signos if not s.presente}
    assert presentes == caso.presentes
    assert negados == caso.negados
    assert ficha.peso_kg is not None
    assert ficha.temperatura_c is not None

    assert resultado.sugerencias, "con signos siempre tiene que haber sugerencias"
    assert resultado.sugerencias[0].codigo == caso.primera
    assert resultado.evidencia_suficiente is caso.evidencia_suficiente


def test_caso_trampa_ya_no_infla_una_patologia_que_no_explica_los_signos() -> None:
    _, resultado = _correr(CASOS["10-kiki-caso-trampa"])

    assert resultado.otra_causa_pct is not None
    assert resultado.otra_causa_pct > 80
    assert resultado.sugerencias[0].probabilidad_pct < 10


def test_casos_fuertes_siguen_arriba_de_99() -> None:
    for nombre in ("2-mora-displasia", "4-kiki-gastroenteritis"):
        _, resultado = _correr(CASOS[nombre])
        assert resultado.sugerencias[0].probabilidad_pct >= 99, nombre


def test_shar_pei_suma_la_predisposicion_de_raza_a_la_dermatitis() -> None:
    """Sin el multiplicador, Felipe daba dermatitis atópica 83 %; con el Shar Pei, 95 %."""
    ficha, resultado = _correr(CASOS["11-felipe-dermatitis-shar-pei"])
    primera = resultado.sugerencias[0]

    assert primera.explicacion["raza"] == {"codigo": "chinese-shar-pei", "multiplicador": 4.0}
    assert primera.probabilidad_pct > 90
    assert ficha.tratamiento is not None and "oclacitinib" in ficha.tratamiento
    assert ficha.observaciones == "Pido raspado cutáneo."
