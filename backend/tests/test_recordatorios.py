from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from urllib.parse import unquote

import pytest

from app.models.agenda.tipo_turno import TipoTurno
from app.models.agenda.turno import Turno
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.clinica.mascota import Mascota
from app.models.clinica.tratamiento_preventivo import TratamientoPreventivo
from app.models.core.persona import Persona
from app.models.sys.config import Config
from app.services.recordatorio_service import mensaje_dosis, mensaje_turno, numero_whatsapp
from test_agenda import TZ, _login, _seed_mascota, _seed_usuario
from test_clientes import _seed_jwt_config

CELULAR_BRUNO = "3406419004"
WHATSAPP_BRUNO = "5493406419004"


def _hoy() -> date:
    return datetime.now(TZ).date()


# ---------------------------------------------------------------------------
# Número de WhatsApp y mensajes (funciones puras)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("celular", "esperado"),
    [
        ("3406419004", "5493406419004"),
        ("+54 9 3406 41-9004", "5493406419004"),
        ("54 3406 419004", "5493406419004"),
        ("0054 9 3406 419004", "5493406419004"),
        ("03406 15 419004", "5493406419004"),
        ("0341 15 555-1234", "5493415551234"),
        ("341 5551234", "5493415551234"),
        ("11 15 2345-6789", "5491123456789"),
        ("011 2345 6789", "5491123456789"),
        ("123", None),
        ("0", None),
        ("", None),
        (None, None),
    ],
)
def test_numero_whatsapp(celular, esperado) -> None:
    assert numero_whatsapp(celular) == esperado


def test_mensaje_de_turno_dice_manana_y_la_hora() -> None:
    hoy = date(2026, 11, 17)
    texto = mensaje_turno(
        tutor_nombre="Joaquín",
        mascota="Simón",
        inicio_local=datetime(2026, 11, 18, 10, 0, tzinfo=TZ),
        tipo_turno="Consulta",
        veterinario="Valeria Sosa",
        clinica="Yacanvet",
        hoy=hoy,
    )
    assert texto.startswith("¡Hola Joaquín! Te recordamos el turno de Simón en Yacanvet")
    assert "mañana miércoles 18/11 a las 10:00 (Consulta con Valeria Sosa)" in texto


def test_mensaje_de_dosis_por_vencer_y_vencida() -> None:
    hoy = date(2026, 11, 17)
    comun = {"tutor_nombre": "Joaquín Ferreyra", "mascota": "Felipe", "clinica": "Yacanvet", "hoy": hoy}
    por_vencer = mensaje_dosis(
        tipo="vacunacion", producto="Séxtuple", fecha_proxima=date(2026, 11, 20), **comun
    )
    assert "¡Hola Joaquín!" in por_vencer
    assert "le toca el refuerzo de la vacuna (Séxtuple): vence el 20/11" in por_vencer
    manana = mensaje_dosis(
        tipo="desparasitacion", producto="Antiparasitario", fecha_proxima=date(2026, 11, 18), **comun
    )
    assert "refuerzo de la desparasitación (Antiparasitario): vence mañana" in manana
    vencida = mensaje_dosis(
        tipo="vacunacion", producto="Antirrábica", fecha_proxima=date(2026, 11, 10), **comun
    )
    assert "La vacuna de Felipe (Antirrábica) venció el 10/11" in vencida


# ---------------------------------------------------------------------------
# Listado y envío
# ---------------------------------------------------------------------------


def _turno(session, s: dict, mascota_id: int, inicio_local: datetime, estado: str = "confirmado"):
    inicio = inicio_local.astimezone(timezone.utc)
    turno = Turno(
        mascota_id=mascota_id,
        veterinario_id=s["vet"].id,
        tipo_turno_id=s["tipo"].id,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=inicio + timedelta(minutes=30),
        estado=estado,
        canal_origen="mostrador",
    )
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno


def _dosis(session, s: dict, mascota_id: int, *, proxima_en: int, **extra) -> TratamientoPreventivo:
    hoy = _hoy()
    dosis = TratamientoPreventivo(
        mascota_id=mascota_id,
        tipo=extra.pop("tipo", "vacunacion"),
        nombre_producto=extra.pop("nombre_producto", "Séxtuple"),
        fecha_aplicacion=hoy - timedelta(days=365 - proxima_en),
        fecha_proxima_dosis=hoy + timedelta(days=proxima_en),
        usuario_id=s["vet"].id,
        **extra,
    )
    session.add(dosis)
    session.commit()
    session.refresh(dosis)
    return dosis


def _escenario(client, session) -> dict:
    _seed_jwt_config(session)
    session.commit()
    vet = _seed_usuario(
        session, username="vet", permisos=["agenda:atender"], rol_nombre="VETERINARIO",
        nombre="Valeria", apellido="Sosa",
    )
    _seed_usuario(
        session, username="recep", permisos=["recordatorios:enviar"], rol_nombre="RECEPCION",
        nombre="Rita", apellido="Recepción",
    )
    tipo = TipoTurno(nombre="Consulta", duracion_min=30, activo=True)
    session.add(tipo)
    session.commit()
    session.refresh(tipo)
    s = {"vet": vet, "tipo": tipo}

    felipe = _seed_mascota(session, nombre="Felipe", tutor_apellido="Ferreyra")
    tutor = session.get(Persona, felipe.persona_id)
    tutor.nombre, tutor.celular = "Joaquín", CELULAR_BRUNO
    session.add(tutor)
    simon = Mascota(
        persona_id=tutor.id, raza_id=felipe.raza_id, nombre="Simón",
        mascota_estado_id=felipe.mascota_estado_id,
    )
    session.add(simon)
    session.commit()
    session.refresh(simon)
    s.update(felipe=felipe, simon=simon, tutor=tutor)

    manana = _hoy() + timedelta(days=1)
    s["turno_manana"] = _turno(session, s, simon.id, datetime(manana.year, manana.month, manana.day, 10, 0, tzinfo=TZ))
    s["turno_cancelado"] = _turno(
        session, s, felipe.id, datetime(manana.year, manana.month, manana.day, 11, 0, tzinfo=TZ),
        estado="cancelado",
    )
    pasado = manana + timedelta(days=1)
    s["turno_pasado_manana"] = _turno(session, s, felipe.id, datetime(pasado.year, pasado.month, pasado.day, 9, 30, tzinfo=TZ))

    s["por_vencer"] = _dosis(session, s, felipe.id, proxima_en=3)
    s["vencida"] = _dosis(session, s, simon.id, proxima_en=-10, nombre_producto="Antirrábica")
    _dosis(session, s, felipe.id, proxima_en=20)  # todavía falta: no aparece
    _dosis(session, s, felipe.id, proxima_en=-40)  # vencida hace mucho: no aparece
    reforzada = _dosis(session, s, simon.id, proxima_en=2, nombre_producto="Antiparasitario")
    _dosis(session, s, simon.id, proxima_en=300, refuerzo_de_id=reforzada.id)
    _login(client, "recep")
    return s


def _pendientes(client, **params) -> dict:
    response = client.get("/api/recordatorios/pendientes", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_lista_los_turnos_de_manana_con_el_link_de_whatsapp(client, session) -> None:
    s = _escenario(client, session)
    data = _pendientes(client)
    assert data["fecha_turnos"] == (_hoy() + timedelta(days=1)).isoformat()
    assert [t["turno_id"] for t in data["turnos"]] == [s["turno_manana"].id]
    turno = data["turnos"][0]
    assert turno["mascota_nombre"] == "Simón"
    assert turno["tutor"]["whatsapp"] == WHATSAPP_BRUNO
    assert turno["veterinario_nombre"] == "Valeria Sosa"
    assert "mañana" in turno["mensaje"] and "a las 10:00" in turno["mensaje"]
    assert turno["url_whatsapp"].startswith(f"https://wa.me/{WHATSAPP_BRUNO}?text=")
    assert unquote(turno["url_whatsapp"].split("text=")[1]) == turno["mensaje"]
    assert turno["envios"] == 0 and turno["ultimo_envio"] is None


def test_se_pueden_pedir_los_turnos_de_otro_dia(client, session) -> None:
    s = _escenario(client, session)
    pasado = (_hoy() + timedelta(days=2)).isoformat()
    data = _pendientes(client, fecha_turnos=pasado)
    assert [t["turno_id"] for t in data["turnos"]] == [s["turno_pasado_manana"].id]


def test_lista_las_dosis_por_vencer_y_vencidas_sin_refuerzo(client, session) -> None:
    s = _escenario(client, session)
    dosis = _pendientes(client)["dosis"]
    assert [d["tratamiento_preventivo_id"] for d in dosis] == [s["vencida"].id, s["por_vencer"].id]
    assert [d["dias_para_vencer"] for d in dosis] == [-10, 3]
    assert "venció" in dosis[0]["mensaje"]
    assert "le toca el refuerzo" in dosis[1]["mensaje"]


def test_no_recuerda_dosis_de_mascotas_que_no_se_atienden(client, session) -> None:
    s = _escenario(client, session)
    obito = MascotaEstado(nombre="Óbito (Natural/Trauma)", activo=True)
    session.add(obito)
    session.flush()
    simon = session.get(Mascota, s["simon"].id)
    simon.mascota_estado_id = obito.id
    session.add(simon)
    session.commit()
    dosis = _pendientes(client)["dosis"]
    assert [d["tratamiento_preventivo_id"] for d in dosis] == [s["por_vencer"].id]


def test_enviar_registra_el_recordatorio_y_lo_marca(client, session) -> None:
    s = _escenario(client, session)
    response = client.post("/api/recordatorios", json={"turno_id": s["turno_manana"].id})
    assert response.status_code == 201, response.text
    enviado = response.json()
    assert enviado["destino"] == WHATSAPP_BRUNO
    assert enviado["usuario_nombre"] == "Rita Recepción"
    assert enviado["url_whatsapp"].startswith(f"https://wa.me/{WHATSAPP_BRUNO}")

    client.post("/api/recordatorios", json={"tratamiento_preventivo_id": s["por_vencer"].id})
    data = _pendientes(client)
    assert data["turnos"][0]["envios"] == 1
    assert data["turnos"][0]["ultimo_envio"]["usuario_nombre"] == "Rita Recepción"
    por_vencer = next(d for d in data["dosis"] if d["tratamiento_preventivo_id"] == s["por_vencer"].id)
    assert por_vencer["envios"] == 1


def test_enviar_valida_el_origen(client, session) -> None:
    s = _escenario(client, session)
    ambos = {"turno_id": s["turno_manana"].id, "tratamiento_preventivo_id": s["por_vencer"].id}
    assert client.post("/api/recordatorios", json=ambos).status_code == 422
    assert client.post("/api/recordatorios", json={}).status_code == 422
    cancelado = client.post("/api/recordatorios", json={"turno_id": s["turno_cancelado"].id})
    assert cancelado.status_code == 400
    assert cancelado.json()["error"] == "TURNO_NO_PENDIENTE"
    inexistente = client.post("/api/recordatorios", json={"tratamiento_preventivo_id": 9999})
    assert inexistente.status_code == 404


def test_tutor_eventual_o_celular_invalido_no_se_puede_enviar(client, session) -> None:
    s = _escenario(client, session)
    eventual = Persona(nombre="Tutor Eventual", apellido="Anónimo", celular="0", es_cliente=True)
    session.add(eventual)
    session.flush()
    session.add(
        Config(config_id=3, config_nombre="SISTEMA", parametro_id=1,
               parametro_nombre="PERSONA_ID_TUTOR_EVENTUAL", parametro_valor=str(eventual.id))
    )
    rescate = Mascota(persona_id=eventual.id, raza_id=s["felipe"].raza_id, nombre="Lola",
                      mascota_estado_id=s["felipe"].mascota_estado_id)
    session.add(rescate)
    session.commit()
    dosis = _dosis(session, s, rescate.id, proxima_en=1)

    item = next(d for d in _pendientes(client)["dosis"] if d["tratamiento_preventivo_id"] == dosis.id)
    assert item["tutor"]["whatsapp"] is None
    assert item["tutor"]["motivo_sin_whatsapp"].startswith("Tutor eventual")
    assert item["url_whatsapp"] is None
    response = client.post("/api/recordatorios", json={"tratamiento_preventivo_id": dosis.id})
    assert response.status_code == 400
    assert response.json()["error"] == "SIN_WHATSAPP"

    tutor = session.get(Persona, s["tutor"].id)
    tutor.celular = "123"
    session.add(tutor)
    session.commit()
    turno = _pendientes(client)["turnos"][0]
    assert turno["tutor"]["whatsapp"] is None
    assert "formato válido" in turno["tutor"]["motivo_sin_whatsapp"]


def test_permisos(client, session) -> None:
    s = _escenario(client, session)
    _login(client, "vet")
    assert client.get("/api/recordatorios/pendientes").status_code == 403
    assert client.post("/api/recordatorios", json={"turno_id": s["turno_manana"].id}).status_code == 403
