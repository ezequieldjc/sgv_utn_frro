from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from sqlmodel import select

from app.core.time_utils import utc_now
from app.models.agenda.turno import Turno
from app.models.clinica.consulta import Consulta
from app.models.clinica.consulta_diagnostico import ConsultaDiagnostico
from app.models.clinica.consulta_sintoma import ConsultaSintoma
from app.models.clinica.dictado import Dictado
from app.models.clinica.mascota import Mascota
from app.models.clinica.patologia import Patologia
from app.models.clinica.raza import Raza
from app.models.clinica.sintoma import Sintoma
from app.services import motor_simulado, nlp_simulado
from test_agenda import _login, _seed_mascota, _seed_tipos, _seed_usuario
from test_clientes import _seed_jwt_config

PERMISOS_VETERINARIO = [
    "consultas:crear",
    "consultas:firmar",
    "consultas:ver_historial",
    "consultas:ver_historia_clinica",
]

# Mismo catálogo que scripts/clinica/006_datos_prototipo.sql
SINTOMAS = [
    ("estertor_ronquido", "Ronquido / estertor", "respiratorio", "observable"),
    ("intolerancia_ejercicio", "Intolerancia al ejercicio", "general", "observable"),
    ("disnea", "Dificultad respiratoria", "respiratorio", "examen"),
    ("cianosis", "Cianosis", "respiratorio", "examen"),
    ("sincope", "Síncope (desmayo)", "cardiovascular", "observable"),
    ("regurgitacion", "Regurgitación", "digestivo", "observable"),
    ("tos", "Tos", "respiratorio", "observable"),
    ("vomito", "Vómitos", "digestivo", "observable"),
    ("diarrea", "Diarrea", "digestivo", "observable"),
    ("decaimiento", "Decaimiento", "general", "observable"),
    ("inapetencia", "Inapetencia", "digestivo", "observable"),
    ("fiebre", "Fiebre", "general", "examen"),
    ("dolor_abdominal", "Dolor abdominal", "digestivo", "examen"),
    ("claudicacion", "Claudicación (renguera)", "musculoesqueletico", "observable"),
    ("dolor_cadera", "Dolor de cadera", "musculoesqueletico", "examen"),
    ("dificultad_levantarse", "Dificultad para levantarse", "musculoesqueletico", "observable"),
    ("prurito", "Prurito (picazón)", "piel", "observable"),
    ("lamido_patas", "Lamido de patas", "piel", "observable"),
    ("sacudida_cabeza", "Sacudida de cabeza", "oido", "observable"),
    ("secrecion_otica", "Secreción en el oído", "oido", "examen"),
]
PATOLOGIAS = [
    ("brachycephalic-obstructive-airway-syndrome", "Síndrome braquicefálico", "0.01000", True),
    ("acute-gastroenteritis", "Gastroenteritis aguda", "0.05000", False),
    ("hip-dysplasia", "Displasia de cadera", "0.02000", False),
    ("otitis-externa", "Otitis externa", "0.04000", False),
    ("atopic-dermatitis", "Dermatitis atópica", "0.03000", False),
]

DICTADO_COCO = (
    "Coco viene porque ronca mucho y se cansa enseguida cuando sale a caminar. "
    "La dueña cuenta que a veces devuelve la comida sin esfuerzo después de comer, "
    "que tose de noche y que nunca se desmayó. "
    "Pesa 13,2 kilos, temperatura 38,9. "
    "Respira con dificultad y las mucosas se ponen azuladas cuando se agita. "
    "Indico reposo y control en diez días."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_catalogo(session) -> None:
    session.add_all(
        Sintoma(codigo=c, nombre_es=n, sistema=s, tipo=t, activo=True) for c, n, s, t in SINTOMAS
    )
    session.add_all(
        Patologia(
            codigo=c,
            nombre=n,
            prevalencia=Decimal(p),
            prevalencia_nivel="media",
            solo_razas_predispuestas=solo,
            activo=True,
        )
        for c, n, p, solo in PATOLOGIAS
    )
    session.commit()


def _seed_veterinario(session, username: str = "vet", permisos: list[str] | None = None):
    return _seed_usuario(
        session,
        username=username,
        permisos=PERMISOS_VETERINARIO if permisos is None else permisos,
        rol_nombre="VETERINARIO",
    )


def _seed_coco(session) -> Mascota:
    mascota = _seed_mascota(session, nombre="Coco")
    raza = session.get(Raza, mascota.raza_id)
    raza.codigo = "french-bulldog"
    session.add(raza)
    session.commit()
    session.refresh(mascota)
    return mascota


def _seed_turno(session, mascota: Mascota, veterinario_id: int, estado: str = "confirmado") -> Turno:
    tipos = _seed_tipos(session)
    inicio = utc_now() + timedelta(hours=1)
    turno = Turno(
        mascota_id=mascota.id or 0,
        veterinario_id=veterinario_id,
        tipo_turno_id=tipos["consulta"].id or 0,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=inicio + timedelta(minutes=30),
        estado=estado,
        canal_origen="mostrador",
    )
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno


@pytest.fixture()
def escenario(session, client):
    """Veterinario logueado, catálogo cargado, Coco (bulldog francés) y su turno confirmado."""
    _seed_jwt_config(session)
    _seed_catalogo(session)
    vet = _seed_veterinario(session)
    coco = _seed_coco(session)
    turno = _seed_turno(session, coco, vet.id or 0)
    _login(client, "vet")
    return {"vet": vet, "coco": coco, "turno": turno}


def _abrir(client, escenario) -> dict:
    response = client.post(
        "/api/consultas",
        json={"mascota_id": escenario["coco"].id, "turno_id": escenario["turno"].id},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _dictar(client, consulta_id: int, texto: str = DICTADO_COCO) -> dict:
    response = client.post(f"/api/consultas/{consulta_id}/dictados", json={"texto": texto})
    assert response.status_code == 200, response.text
    return response.json()


def _signos_por_codigo(detalle: dict) -> dict[str, dict]:
    return {s["codigo"]: s for s in detalle["signos"] if s["codigo"]}


# ---------------------------------------------------------------------------
# Alta
# ---------------------------------------------------------------------------


def test_crear_consulta_desde_turno_devuelve_201_en_borrador_con_datos_de_la_mascota(
    client, escenario
):
    detalle = _abrir(client, escenario)

    assert detalle["estado"] == "borrador"
    assert detalle["turno_id"] == escenario["turno"].id
    assert detalle["veterinario_id"] == escenario["vet"].id
    assert detalle["mascota"]["nombre"] == "Coco"
    assert detalle["mascota"]["raza_codigo"] == "french-bulldog"
    assert detalle["signos"] == [] and detalle["diagnosticos"] == []


def test_crear_consulta_para_un_turno_que_ya_tiene_consulta_devuelve_la_existente_con_200(
    client, escenario
):
    primera = _abrir(client, escenario)

    segunda = client.post(
        "/api/consultas",
        json={"mascota_id": escenario["coco"].id, "turno_id": escenario["turno"].id},
    )

    assert segunda.status_code == 200
    assert segunda.json()["id"] == primera["id"]


def test_crear_consulta_con_turno_de_otra_mascota_devuelve_400(client, session, escenario):
    otra = _seed_mascota(session, nombre="Luna", tutor_apellido="Perez")

    response = client.post(
        "/api/consultas", json={"mascota_id": otra.id, "turno_id": escenario["turno"].id}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_OTRA_MASCOTA"


def test_crear_consulta_con_turno_cancelado_devuelve_409(client, session, escenario):
    escenario["turno"].estado = "cancelado"
    session.add(escenario["turno"])
    session.commit()

    response = client.post(
        "/api/consultas",
        json={"mascota_id": escenario["coco"].id, "turno_id": escenario["turno"].id},
    )

    assert response.status_code == 409
    assert response.json()["error"] == "TURNO_NO_ATENDIBLE"


def test_crear_consulta_sin_turno_queda_en_borrador_sin_turno(client, escenario):
    response = client.post("/api/consultas", json={"mascota_id": escenario["coco"].id})

    assert response.status_code == 201
    assert response.json()["turno_id"] is None


def test_crear_consulta_sin_permiso_devuelve_403(client, session):
    _seed_jwt_config(session)
    _seed_usuario(session, username="recep", permisos=["agenda:ver"], rol_nombre="RECEPCION")
    mascota = _seed_mascota(session, nombre="Coco")
    _login(client, "recep")

    response = client.post("/api/consultas", json={"mascota_id": mascota.id})

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Dictado (NLP simulado)
# ---------------------------------------------------------------------------


def test_dictado_completa_textos_peso_temperatura_y_signos_con_el_negado(
    client, session, escenario
):
    consulta = _abrir(client, escenario)

    detalle = _dictar(client, consulta["id"])

    assert detalle["motivo"].startswith("Ronca mucho")
    assert "La dueña cuenta" in detalle["anamnesis"]
    assert "mucosas" in detalle["examen_fisico"]
    assert "Indico reposo" in detalle["tratamiento"]
    assert Decimal(str(detalle["peso_kg"])) == Decimal("13.2")
    assert Decimal(str(detalle["temperatura_c"])) == Decimal("38.9")
    signos = _signos_por_codigo(detalle)
    assert set(signos) == {
        "estertor_ronquido",
        "intolerancia_ejercicio",
        "regurgitacion",
        "tos",
        "sincope",
        "disnea",
        "cianosis",
    }
    assert signos["sincope"]["presente"] is False
    assert all(s["presente"] for c, s in signos.items() if c != "sincope")
    assert all(s["origen"] == "nlp" and not s["confirmado"] for s in signos.values())

    dictado = session.exec(select(Dictado)).one()
    assert dictado.modelo_stt == "texto"
    assert dictado.modelo_llm is None
    assert dictado.version_prompt == nlp_simulado.VERSION_EXTRACTOR
    assert dictado.extraccion_json["version"] == "1.0"
    assert len(dictado.extraccion_json["signos"]) == 7


def test_dictado_con_temperatura_imposible_la_deja_nula_y_conserva_la_frase(client, escenario):
    consulta = _abrir(client, escenario)

    detalle = _dictar(client, consulta["id"], "Control. Temperatura 380 grados, tose.")

    assert detalle["temperatura_c"] is None
    assert "380" in detalle["examen_fisico"]
    assert "tos" in _signos_por_codigo(detalle)


def test_segundo_dictado_agrega_texto_y_no_pisa_un_signo_confirmado(client, escenario):
    consulta = _abrir(client, escenario)
    detalle = _dictar(client, consulta["id"])
    tos = _signos_por_codigo(detalle)["tos"]
    client.patch(f"/api/consultas/{consulta['id']}/signos/{tos['id']}", json={"presente": True})

    detalle = _dictar(client, consulta["id"], "La dueña aclara que no tose. Pesa 13,5 kilos.")

    signos = _signos_por_codigo(detalle)
    assert signos["tos"]["presente"] is True
    assert signos["tos"]["confirmado"] is True
    assert "aclara" in detalle["anamnesis"] and "La dueña cuenta" in detalle["anamnesis"]
    assert Decimal(str(detalle["peso_kg"])) == Decimal("13.5")


def test_dictado_en_consulta_firmada_devuelve_409(client, escenario):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])
    _firmar_con_principal_ia(client, consulta["id"])

    response = client.post(
        f"/api/consultas/{consulta['id']}/dictados", json={"texto": "Otro dictado"}
    )

    assert response.status_code == 409
    assert response.json()["error"] == "CONSULTA_FIRMADA"


# ---------------------------------------------------------------------------
# Correcciones
# ---------------------------------------------------------------------------


def test_signo_manual_se_agrega_confirmado_y_se_puede_negar_y_quitar(client, session, escenario):
    consulta = _abrir(client, escenario)
    vomito = session.exec(select(Sintoma).where(Sintoma.codigo == "vomito")).one()

    detalle = client.post(
        f"/api/consultas/{consulta['id']}/signos", json={"sintoma_id": vomito.id}
    ).json()
    signo = _signos_por_codigo(detalle)["vomito"]
    assert signo["origen"] == "manual" and signo["confirmado"] and signo["presente"]

    detalle = client.patch(
        f"/api/consultas/{consulta['id']}/signos/{signo['id']}", json={"presente": False}
    ).json()
    assert _signos_por_codigo(detalle)["vomito"]["presente"] is False

    detalle = client.delete(f"/api/consultas/{consulta['id']}/signos/{signo['id']}").json()
    assert "vomito" not in _signos_por_codigo(detalle)


def test_patch_consulta_actualiza_solo_los_campos_enviados(client, escenario):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])

    response = client.patch(
        f"/api/consultas/{consulta['id']}", json={"motivo": "Ronquidos", "peso_kg": "14"}
    )

    assert response.status_code == 200
    detalle = response.json()
    assert detalle["motivo"] == "Ronquidos"
    assert Decimal(str(detalle["peso_kg"])) == Decimal("14")
    assert "Indico reposo" in detalle["tratamiento"]


def test_patch_consulta_con_peso_fuera_de_rango_devuelve_422(client, escenario):
    consulta = _abrir(client, escenario)

    response = client.patch(f"/api/consultas/{consulta['id']}", json={"peso_kg": "380"})

    assert response.status_code == 422


def test_descartar_borrador_borra_la_consulta_con_sus_dictados_y_signos(client, session, escenario):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])

    response = client.delete(f"/api/consultas/{consulta['id']}")

    assert response.status_code == 204
    assert session.exec(select(Consulta)).all() == []
    assert session.exec(select(Dictado)).all() == []
    assert session.exec(select(ConsultaSintoma)).all() == []


# ---------------------------------------------------------------------------
# Sugerencias (motor simulado)
# ---------------------------------------------------------------------------


def test_sugerencias_para_bulldog_con_signos_respiratorios_ponen_primero_al_braquicefalico(
    client, escenario
):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])

    response = client.get(f"/api/consultas/{consulta['id']}/sugerencias")

    assert response.status_code == 200
    data = response.json()
    assert data["version_motor"] == motor_simulado.VERSION_MOTOR
    primera = data["sugerencias"][0]
    assert primera["codigo"] == "brachycephalic-obstructive-airway-syndrome"
    assert primera["ranking"] == 1
    assert primera["explicacion"]["raza"] == {"codigo": "french-bulldog", "multiplicador": 4.0}
    assert [s["codigo"] for s in primera["explicacion"]["sintomas_negados"]] == ["sincope"]
    assert len(data["sugerencias"]) <= 3
    # Con siete signos que explica el braquicefálico, "otra causa" casi no pesa.
    assert data["evidencia_suficiente"] is True
    assert Decimal(data["otra_causa_pct"]) < Decimal("1")


def test_sugerencias_sin_signos_devuelve_lista_vacia(client, escenario):
    consulta = _abrir(client, escenario)

    data = client.get(f"/api/consultas/{consulta['id']}/sugerencias").json()

    assert data["sugerencias"] == []
    assert data["otra_causa_pct"] is None
    assert data["evidencia_suficiente"] is False


def test_motor_excluye_patologias_de_conformacion_en_razas_no_predispuestas():
    patologias = [
        motor_simulado.PatologiaEntrada(1, "brachycephalic-obstructive-airway-syndrome", "BOAS", 0.01, True),
        motor_simulado.PatologiaEntrada(2, "acute-gastroenteritis", "Gastro", 0.05),
    ]
    signos = [motor_simulado.SignoEntrada("estertor_ronquido", True)]

    resultado = motor_simulado.diagnosticar("labrador-retriever", signos, patologias)

    assert [s.codigo for s in resultado.sugerencias] == ["acute-gastroenteritis"]
    # Antes la gastroenteritis se llevaba el 100 % solo por ser la única que quedaba.
    # Un ronquido no la explica: lo más probable es una causa fuera del catálogo.
    assert resultado.evidencia_suficiente is False
    assert resultado.otra_causa_pct is not None
    assert resultado.otra_causa_pct > resultado.sugerencias[0].probabilidad_pct


def test_motor_otra_causa_tiene_piso_aunque_las_prevalencias_sumen_mas_de_uno():
    patologias = [
        motor_simulado.PatologiaEntrada(i, codigo, codigo, 0.5)
        for i, codigo in enumerate(motor_simulado.BASE_CONOCIMIENTO, start=1)
    ]

    assert motor_simulado.probabilidad_otra_causa(patologias) == (
        motor_simulado.PROBABILIDAD_OTRA_CAUSA_MINIMA
    )


def test_motor_es_deterministico_y_los_porcentajes_no_superan_100():
    patologias = [
        motor_simulado.PatologiaEntrada(i, codigo, codigo, 0.03)
        for i, codigo in enumerate(motor_simulado.BASE_CONOCIMIENTO, start=1)
    ]
    signos = [
        motor_simulado.SignoEntrada("vomito", True),
        motor_simulado.SignoEntrada("diarrea", True),
        motor_simulado.SignoEntrada("tos", False),
    ]

    primera = motor_simulado.diagnosticar(None, signos, patologias)
    segunda = motor_simulado.diagnosticar(None, signos, patologias)

    assert primera == segunda
    assert primera.sugerencias[0].codigo == "acute-gastroenteritis"
    assert primera.evidencia_suficiente is True
    # Top 3 + otra causa no pasan de 100 (más el redondeo a dos decimales de cada uno).
    assert primera.otra_causa_pct is not None
    total = sum(s.probabilidad_pct for s in primera.sugerencias) + primera.otra_causa_pct
    assert total <= Decimal("100.02")


# ---------------------------------------------------------------------------
# Firma
# ---------------------------------------------------------------------------


def _firmar_con_principal_ia(client, consulta_id: int, extra: list[dict] | None = None):
    sugerencias = client.get(f"/api/consultas/{consulta_id}/sugerencias").json()["sugerencias"]
    diagnosticos = [
        {
            "origen": "sugerido_ia",
            "tipo_diagnostico": "principal",
            "patologia_id": sugerencias[0]["patologia_id"],
        },
        *(extra or []),
    ]
    return client.post(f"/api/consultas/{consulta_id}/firmar", json={"diagnosticos": diagnosticos})


def test_firmar_guarda_diagnosticos_confirma_signos_atiende_turno_y_actualiza_peso(
    client, session, escenario
):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])

    response = _firmar_con_principal_ia(
        client,
        consulta["id"],
        extra=[
            {
                "origen": "manual",
                "tipo_diagnostico": "secundario",
                "descripcion_libre": "Sobrepeso leve",
            }
        ],
    )

    assert response.status_code == 200, response.text
    detalle = response.json()
    assert detalle["estado"] == "firmada" and detalle["fecha_firma"] is not None
    assert all(s["confirmado"] for s in detalle["signos"])
    principal, secundario = detalle["diagnosticos"]
    assert principal["tipo_diagnostico"] == "principal"
    assert principal["origen"] == "sugerido_ia" and principal["ranking"] == 1
    assert principal["probabilidad_pct"] is not None
    assert secundario["descripcion_libre"] == "Sobrepeso leve"

    session.expire_all()
    fila = session.exec(
        select(ConsultaDiagnostico).where(ConsultaDiagnostico.tipo_diagnostico == "principal")
    ).one()
    assert fila.version_motor == motor_simulado.VERSION_MOTOR
    assert fila.confirmado_por_usuario_id == escenario["vet"].id
    assert fila.explicacion["raza"]["codigo"] == "french-bulldog"
    assert session.get(Turno, escenario["turno"].id).estado == "atendido"
    assert session.get(Mascota, escenario["coco"].id).ultimo_peso == Decimal("13.2")


def test_firmar_sin_diagnostico_principal_devuelve_422(client, escenario):
    consulta = _abrir(client, escenario)

    response = client.post(
        f"/api/consultas/{consulta['id']}/firmar",
        json={
            "diagnosticos": [
                {"origen": "manual", "tipo_diagnostico": "secundario", "descripcion_libre": "X"}
            ]
        },
    )

    assert response.status_code == 422


def test_firmar_con_una_sugerencia_que_no_esta_en_el_top_3_devuelve_409(
    client, session, escenario
):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])
    otitis = session.exec(select(Patologia).where(Patologia.codigo == "otitis-externa")).one()

    response = client.post(
        f"/api/consultas/{consulta['id']}/firmar",
        json={
            "diagnosticos": [
                {"origen": "sugerido_ia", "tipo_diagnostico": "principal", "patologia_id": otitis.id}
            ]
        },
    )

    assert response.status_code == 409
    assert response.json()["error"] == "SUGERENCIA_NO_VIGENTE"


def test_firmar_con_diagnostico_manual_del_catalogo_es_valido(client, session, escenario):
    consulta = _abrir(client, escenario)
    otitis = session.exec(select(Patologia).where(Patologia.codigo == "otitis-externa")).one()

    response = client.post(
        f"/api/consultas/{consulta['id']}/firmar",
        json={
            "diagnosticos": [
                {"origen": "manual", "tipo_diagnostico": "principal", "patologia_id": otitis.id}
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["diagnosticos"][0]["patologia_nombre"] == "Otitis externa"


def test_firmar_sin_permiso_de_firma_devuelve_403(client, session):
    _seed_jwt_config(session)
    _seed_catalogo(session)
    _seed_veterinario(session, username="residente", permisos=["consultas:crear"])
    coco = _seed_coco(session)
    _login(client, "residente")
    consulta = client.post("/api/consultas", json={"mascota_id": coco.id}).json()

    response = client.post(
        f"/api/consultas/{consulta['id']}/firmar",
        json={
            "diagnosticos": [
                {"origen": "manual", "tipo_diagnostico": "principal", "descripcion_libre": "X"}
            ]
        },
    )

    assert response.status_code == 403


def test_consulta_firmada_es_solo_lectura_y_no_se_puede_descartar(client, escenario):
    consulta = _abrir(client, escenario)
    _dictar(client, consulta["id"])
    _firmar_con_principal_ia(client, consulta["id"])

    patch = client.patch(f"/api/consultas/{consulta['id']}", json={"motivo": "Otro"})
    delete = client.delete(f"/api/consultas/{consulta['id']}")

    assert patch.status_code == 409 and delete.status_code == 409


# ---------------------------------------------------------------------------
# Historia clínica
# ---------------------------------------------------------------------------


def test_historial_de_la_mascota_lista_solo_firmadas_con_su_diagnostico_principal(
    client, escenario
):
    firmada = _abrir(client, escenario)
    _dictar(client, firmada["id"])
    _firmar_con_principal_ia(client, firmada["id"])
    client.post("/api/consultas", json={"mascota_id": escenario["coco"].id})  # borrador

    response = client.get(
        "/api/consultas",
        params={"mascota_id": escenario["coco"].id, "estado": "firmada"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    item = data["items"][0]
    assert item["id"] == firmada["id"]
    assert item["diagnostico_principal"] == "Síndrome braquicefálico"
    assert item["mascota_nombre"] == "Coco"


def test_buscar_mascotas_para_consulta_encuentra_por_nombre(client, escenario):
    response = client.get("/api/consultas/mascotas", params={"q": "coc"})

    assert response.status_code == 200
    assert [m["nombre"] for m in response.json()] == ["Coco"]


def test_catalogo_de_sintomas_devuelve_los_activos(client, escenario):
    response = client.get("/api/consultas/catalogos/sintomas")

    assert response.status_code == 200
    assert len(response.json()) == len(SINTOMAS)


# ---------------------------------------------------------------------------
# Extractor por reglas (unidad)
# ---------------------------------------------------------------------------

CATALOGO = [nlp_simulado.SintomaCatalogo(c, n) for c, n, _, _ in SINTOMAS]


@pytest.mark.parametrize(
    ("texto", "presentes", "negados"),
    [
        ("No vomita ni tiene diarrea", set(), {"vomito", "diarrea"}),
        ("Vomita desde ayer, pero no tiene diarrea", {"vomito"}, {"diarrea"}),
        ("Renguea de la pata trasera y le cuesta levantarse", {"claudicacion", "dificultad_levantarse"}, set()),
        ("No come y está decaído", {"inapetencia", "decaimiento"}, set()),
        ("Se rasca las orejas y sacude la cabeza", {"prurito", "sacudida_cabeza"}, set()),
    ],
)
def test_extractor_distingue_signos_presentes_y_negados(texto, presentes, negados):
    signos = nlp_simulado.extraer_signos(texto, CATALOGO)

    assert {s.codigo for s in signos if s.presente} == presentes
    assert {s.codigo for s in signos if not s.presente} == negados


@pytest.mark.parametrize(
    ("texto", "peso", "temperatura"),
    [
        ("pesa 32 kilos y tiene temperatura de 39,4", Decimal("32.00"), Decimal("39.4")),
        ("14,5 kg, 38.5 grados", Decimal("14.50"), Decimal("38.5")),
        ("peso 400 kilos, temperatura 380", None, None),
        ("sin datos", None, None),
    ],
)
def test_extractor_de_peso_y_temperatura_respeta_los_rangos(texto, peso, temperatura):
    normalizado = nlp_simulado.normalizar(texto)

    assert nlp_simulado.extraer_peso(normalizado) == peso
    assert nlp_simulado.extraer_temperatura(normalizado) == temperatura
