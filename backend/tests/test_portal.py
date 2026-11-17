"""Portal del cliente: cada cliente ve solo lo suyo y solo lo que le corresponde ver.

Las consultas se arman con el flujo real del veterinario (abrir, dictar, firmar), así la
respuesta del portal se prueba contra datos completos: dictado, signos y porcentajes de la IA
existen en la base y no tienen que llegar al cliente.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.core.time_utils import utc_now
from app.models.agenda.turno import Turno
from app.models.catalogo.rubro import Rubro
from app.models.clinica.mascota import Mascota
from app.models.comercial.detalle_venta import DetalleVenta
from app.models.comercial.venta import Venta
from app.models.sys.config import Config
from app.models.stock.producto import Producto
from app.services.config_service import clear_config_cache
from test_agenda import TZ, _login, _proximo, _seed_mascota, _seed_tipos, _seed_usuario
from test_clientes import _seed_jwt_config
from test_consultas import (
    _dictar,
    _firmar_con_principal_ia,
    _seed_catalogo,
    _seed_veterinario,
)

PERMISO_PORTAL = "portal:ver"
PERMISO_PEDIR_TURNO = "portal:pedir_turno"

# Claves que existen del lado veterinario y nunca pueden aparecer en el portal.
CLAVES_PROHIBIDAS = {
    "dictados",
    "transcripcion",
    "signos",
    "probabilidad_pct",
    "ranking",
    "explicacion",
    "origen",
    "anamnesis",
    "examen_fisico",
    "observaciones",
    "consulta_padre",
    "controles",
    "estado",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _claves(valor) -> set[str]:
    """Todas las claves de un JSON, a cualquier profundidad."""
    if isinstance(valor, dict):
        return set(valor) | {k for v in valor.values() for k in _claves(v)}
    if isinstance(valor, list):
        return {k for v in valor for k in _claves(v)}
    return set()


def _seed_cliente(session, username: str, nombre: str):
    usuario = _seed_usuario(
        session,
        username=username,
        permisos=[PERMISO_PORTAL, PERMISO_PEDIR_TURNO],
        rol_nombre="CLIENTE",
        nombre=nombre,
        apellido="Cliente",
    )
    usuario.persona.es_cliente = True
    session.add(usuario.persona)
    session.commit()
    session.refresh(usuario)
    return usuario


def _mascota_de(session, usuario, nombre: str, raza_codigo: str | None = None) -> Mascota:
    mascota = _seed_mascota(session, nombre=nombre)
    mascota.persona_id = usuario.persona_id
    if raza_codigo:
        mascota.raza.codigo = raza_codigo
        session.add(mascota.raza)
    session.add(mascota)
    session.commit()
    session.refresh(mascota)
    return mascota


def _turno(session, mascota, vet_id: int, tipo_id: int, *, en_horas: int, estado: str) -> Turno:
    inicio = utc_now() + timedelta(hours=en_horas)
    turno = Turno(
        mascota_id=mascota.id or 0,
        veterinario_id=vet_id,
        tipo_turno_id=tipo_id,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=inicio + timedelta(minutes=30),
        estado=estado,
        canal_origen="mostrador",
    )
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno


def _consulta_firmada(client, mascota, turno) -> int:
    """Flujo real del veterinario: abre desde el turno, dicta y firma con la sugerencia de la IA."""
    _login(client, "vet")
    consulta = client.post(
        "/api/consultas", json={"mascota_id": mascota.id, "turno_id": turno.id}
    ).json()
    _dictar(client, consulta["id"])
    response = _firmar_con_principal_ia(
        client,
        consulta["id"],
        extra=[
            {
                "origen": "manual",
                "tipo_diagnostico": "secundario",
                "descripcion_libre": "Sobrepeso",
            }
        ],
    )
    assert response.status_code == 200, response.text
    return consulta["id"]


def _venta(session, cliente, vendedor_id: int, producto: Producto, cantidad: int) -> Venta:
    venta = Venta(
        persona_id=cliente.persona_id,
        usuario_id=vendedor_id,
        total=Decimal("800") * cantidad,
        medio_pago="efectivo",
    )
    session.add(venta)
    session.flush()
    session.add(
        DetalleVenta(
            venta_id=venta.id or 0,
            producto_id=producto.id or 0,
            cantidad=cantidad,
            precio_unitario=Decimal("800"),
        )
    )
    session.commit()
    session.refresh(venta)
    return venta


@pytest.fixture()
def escenario(session, client):
    """Dos clientes con sus mascotas, consultas (firmada y borrador), turnos y compras."""
    _seed_jwt_config(session)
    _seed_catalogo(session)
    vet = _seed_veterinario(session)
    tipos = _seed_tipos(session)
    martin = _seed_cliente(session, "martin", "Martín")
    carla = _seed_cliente(session, "carla", "Carla")

    coco = _mascota_de(session, martin, "Coco", raza_codigo="french-bulldog")
    thor = _mascota_de(session, carla, "Thor")

    turno_coco = _turno(session, coco, vet.id or 0, tipos["consulta"].id or 0, en_horas=1,
                        estado="confirmado")
    firmada = _consulta_firmada(client, coco, turno_coco)
    # Un borrador de Coco: existe, pero para el cliente no.
    _login(client, "vet")
    borrador = client.post("/api/consultas", json={"mascota_id": coco.id}).json()["id"]

    turno_thor = _turno(session, thor, vet.id or 0, tipos["consulta"].id or 0, en_horas=2,
                        estado="confirmado")
    firmada_thor = _consulta_firmada(client, thor, turno_thor)

    proximo = _turno(session, coco, vet.id or 0, tipos["consulta"].id or 0, en_horas=48,
                     estado="confirmado")
    cancelado = _turno(session, coco, vet.id or 0, tipos["cirugia"].id or 0, en_horas=72,
                       estado="cancelado")
    _turno(session, thor, vet.id or 0, tipos["consulta"].id or 0, en_horas=96,
           estado="confirmado")

    rubro = Rubro(nombre="Accesorios", activo=True)
    session.add(rubro)
    session.flush()
    collar = Producto(
        nombre="Collar antipulgas", rubro_id=rubro.id or 0, unidad="unidad",
        contenido_envase=Decimal("1"),
    )
    session.add(collar)
    session.commit()
    compra_martin = _venta(session, martin, vet.id or 0, collar, 2)
    compra_carla = _venta(session, carla, vet.id or 0, collar, 1)

    return {
        "vet": vet,
        "martin": martin,
        "carla": carla,
        "coco": coco,
        "thor": thor,
        "firmada": firmada,
        "borrador": borrador,
        "firmada_thor": firmada_thor,
        "turno_atendido": turno_coco,
        "proximo": proximo,
        "cancelado": cancelado,
        "compra_martin": compra_martin,
        "compra_carla": compra_carla,
        "tipos": tipos,
    }


# ---------------------------------------------------------------------------
# Autenticación y permiso
# ---------------------------------------------------------------------------


def test_portal_sin_sesion_devuelve_401(client, escenario):
    client.cookies.clear()
    assert client.get("/api/portal/mascotas").status_code == 401


def test_portal_con_usuario_sin_permiso_portal_devuelve_403(client, escenario):
    _login(client, "vet")
    for url in ("/api/portal/mascotas", "/api/portal/turnos", "/api/portal/compras"):
        response = client.get(url)
        assert response.status_code == 403
        assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


# ---------------------------------------------------------------------------
# Mascotas
# ---------------------------------------------------------------------------


def test_portal_mascotas_lista_solo_las_del_cliente_logueado(client, escenario):
    _login(client, "martin")
    nombres = [m["nombre"] for m in client.get("/api/portal/mascotas").json()]
    assert nombres == ["Coco"]

    _login(client, "carla")
    nombres = [m["nombre"] for m in client.get("/api/portal/mascotas").json()]
    assert nombres == ["Thor"]


def test_portal_mascota_ajena_devuelve_404_igual_que_una_inexistente(client, escenario):
    _login(client, "martin")
    ajena = client.get(f"/api/portal/mascotas/{escenario['thor'].id}")
    inexistente = client.get("/api/portal/mascotas/999999")

    assert ajena.status_code == inexistente.status_code == 404
    assert ajena.json() == inexistente.json()


def test_portal_mascota_propia_devuelve_datos_basicos(client, escenario):
    _login(client, "martin")
    response = client.get(f"/api/portal/mascotas/{escenario['coco'].id}")

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Coco"
    assert body["estado_nombre"] == "ACTIVA"
    assert "persona_id" not in body


# ---------------------------------------------------------------------------
# Historia clínica
# ---------------------------------------------------------------------------


def test_portal_historia_clinica_lista_solo_consultas_firmadas(client, escenario):
    _login(client, "martin")
    response = client.get(f"/api/portal/mascotas/{escenario['coco'].id}/consultas")

    assert response.status_code == 200
    ids = [c["id"] for c in response.json()]
    assert ids == [escenario["firmada"]]
    assert escenario["borrador"] not in ids
    assert response.json()[0]["diagnostico_principal"]


def test_portal_historia_clinica_de_mascota_ajena_devuelve_404(client, escenario):
    _login(client, "martin")
    response = client.get(f"/api/portal/mascotas/{escenario['thor'].id}/consultas")
    assert response.status_code == 404


def test_portal_consulta_firmada_propia_muestra_solo_lo_que_ve_el_cliente(client, escenario):
    _login(client, "martin")
    response = client.get(f"/api/portal/consultas/{escenario['firmada']}")

    assert response.status_code == 200
    body = response.json()
    assert body["mascota_nombre"] == "Coco"
    assert body["tratamiento"]
    assert body["peso_kg"] is not None
    nombres = [d["nombre"] for d in body["diagnosticos"]]
    assert body["diagnosticos"][0]["principal"] is True
    assert "Sobrepeso" in nombres
    assert _claves(body) & CLAVES_PROHIBIDAS == set()


def test_portal_consulta_no_incluye_el_texto_del_dictado(client, escenario):
    _login(client, "martin")
    texto = client.get(f"/api/portal/consultas/{escenario['firmada']}").text
    assert "nunca se desmayó" not in texto


def test_portal_consulta_en_borrador_propia_devuelve_404(client, escenario):
    _login(client, "martin")
    borrador = client.get(f"/api/portal/consultas/{escenario['borrador']}")
    inexistente = client.get("/api/portal/consultas/999999")

    assert borrador.status_code == 404
    assert borrador.json() == inexistente.json()


def test_portal_consulta_firmada_ajena_devuelve_404(client, escenario):
    _login(client, "martin")
    response = client.get(f"/api/portal/consultas/{escenario['firmada_thor']}")
    assert response.status_code == 404


def test_portal_consulta_de_control_enlaza_la_consulta_anterior(client, session, escenario):
    _login(client, "vet")
    control = client.post(
        "/api/consultas",
        json={"mascota_id": escenario["coco"].id, "consulta_padre_id": escenario["firmada"]},
    ).json()
    _dictar(client, control["id"], "Viene a control. Sigue roncando de noche y ya no tose.")
    firma = _firmar_con_principal_ia(client, control["id"])
    assert firma.status_code == 200, firma.text

    _login(client, "martin")
    detalle = client.get(f"/api/portal/consultas/{control['id']}").json()
    assert detalle["control_de"]["id"] == escenario["firmada"]
    listado = client.get(f"/api/portal/mascotas/{escenario['coco'].id}/consultas").json()
    assert [c["es_control"] for c in listado] == [True, False]


# ---------------------------------------------------------------------------
# Turnos
# ---------------------------------------------------------------------------


def test_portal_turnos_separa_proximos_de_anteriores_y_trae_solo_los_propios(client, escenario):
    _login(client, "martin")
    response = client.get("/api/portal/turnos")

    assert response.status_code == 200
    body = response.json()
    assert [t["id"] for t in body["proximos"]] == [escenario["proximo"].id]
    anteriores = {t["id"]: t["estado"] for t in body["anteriores"]}
    assert anteriores == {
        escenario["cancelado"].id: "cancelado",
        escenario["turno_atendido"].id: "atendido",
    }
    todos = body["proximos"] + body["anteriores"]
    assert {t["mascota_nombre"] for t in todos} == {"Coco"}
    assert all(t["veterinario_nombre"] for t in todos)


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------


def test_portal_compras_trae_solo_las_del_cliente(client, escenario):
    _login(client, "martin")
    response = client.get("/api/portal/compras")

    assert response.status_code == 200
    assert [c["id"] for c in response.json()] == [escenario["compra_martin"].id]
    assert response.json()[0]["cantidad_items"] == 1


def test_portal_compra_propia_devuelve_renglones_sin_datos_del_vendedor(client, escenario):
    _login(client, "martin")
    body = client.get(f"/api/portal/compras/{escenario['compra_martin'].id}").json()

    assert body["items"][0]["producto_nombre"] == "Collar antipulgas"
    assert Decimal(body["items"][0]["subtotal"]) == Decimal("1600")
    assert _claves(body) & {"usuario_id", "usuario_username", "persona_id"} == set()


def test_portal_compra_ajena_devuelve_404_igual_que_una_inexistente(client, escenario):
    _login(client, "martin")
    ajena = client.get(f"/api/portal/compras/{escenario['compra_carla'].id}")
    inexistente = client.get("/api/portal/compras/999999")

    assert ajena.status_code == inexistente.status_code == 404
    assert ajena.json() == inexistente.json()


# ---------------------------------------------------------------------------
# Tutor eventual
# ---------------------------------------------------------------------------


def test_portal_usuario_vinculado_al_tutor_eventual_no_ve_nada(client, session, escenario):
    # Si por error un usuario quedara vinculado a la persona del tutor eventual, no puede ver
    # los rescates: para el portal esa persona no tiene mascotas.
    session.add(
        Config(
            config_id=90,
            config_nombre="MASCOTAS",
            parametro_id=1,
            parametro_nombre="PERSONA_ID_TUTOR_EVENTUAL",
            parametro_valor=str(escenario["martin"].persona_id),
        )
    )
    session.commit()
    clear_config_cache()

    _login(client, "martin")
    assert client.get("/api/portal/mascotas").json() == []
    assert client.get("/api/portal/compras").json() == []
    assert client.get("/api/portal/turnos").json() == {"proximos": [], "anteriores": []}
    assert client.get(f"/api/portal/mascotas/{escenario['coco'].id}").status_code == 404
    assert client.get(f"/api/portal/consultas/{escenario['firmada']}").status_code == 404


# ---------------------------------------------------------------------------
# Pedir y cancelar turnos
# ---------------------------------------------------------------------------


@pytest.fixture()
def turnos_portal(session, escenario):
    """Veterinaria que atiende turnos y el parámetro con los tipos que se piden desde el portal
    (Consulta sí; Cirugía no; el tipo inactivo, aunque esté en el parámetro, tampoco)."""
    vale = _seed_usuario(
        session,
        username="vale",
        permisos=["agenda:atender"],
        rol_nombre="VETERINARIO",
        nombre="Valeria",
        apellido="Sosa",
    )
    tipos = escenario["tipos"]
    session.add(
        Config(
            config_id=4,
            config_nombre="AGENDA",
            parametro_id=90,
            parametro_nombre="TIPOS_TURNO_PORTAL",
            parametro_valor=f"{tipos['consulta'].id},{tipos['inactivo'].id}",
        )
    )
    session.commit()
    clear_config_cache()
    return {**escenario, "vale": vale}


def _pedido(s: dict, *, inicio: datetime, mascota: str = "coco", tipo: str = "consulta") -> dict:
    return {
        "mascota_id": s[mascota].id,
        "veterinario_id": s["vale"].id,
        "tipo_turno_id": s["tipos"][tipo].id,
        "fecha_hora_inicio": inicio.isoformat(),
    }


def test_portal_pedir_turno_sin_permiso_pedir_turno_devuelve_403(client, session, turnos_portal):
    _seed_usuario(
        session, username="lector", permisos=[PERMISO_PORTAL], rol_nombre="CLIENTE_LECTURA"
    )
    _login(client, "lector")

    assert client.get("/api/portal/turnos/opciones").status_code == 403
    response = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9))
    )
    assert response.status_code == 403


def test_portal_opciones_turno_trae_mis_mascotas_y_solo_los_tipos_permitidos(
    client, turnos_portal
):
    _login(client, "martin")
    body = client.get("/api/portal/turnos/opciones").json()

    assert [m["nombre"] for m in body["mascotas"]] == ["Coco"]
    assert [t["nombre"] for t in body["tipos"]] == ["Consulta"]
    assert "Valeria Sosa" in [v["nombre"] for v in body["veterinarios"]]
    manana = (datetime.now(TZ) + timedelta(days=1)).date().isoformat()
    assert body["primer_dia"] == manana


def test_portal_pedir_turno_valido_nace_solicitado_por_portal_y_es_cancelable(
    client, session, turnos_portal
):
    _login(client, "martin")
    response = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9))
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["estado"] == "solicitado"
    assert body["cancelable"] is True
    turno = session.get(Turno, body["id"])
    session.refresh(turno)
    assert turno.canal_origen == "portal"
    proximos = client.get("/api/portal/turnos").json()["proximos"]
    assert body["id"] in [t["id"] for t in proximos]


def test_portal_pedir_turno_para_mascota_ajena_devuelve_404(client, turnos_portal):
    _login(client, "martin")
    response = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9), mascota="thor")
    )
    assert response.status_code == 404
    assert response.json()["error"] == "MASCOTA_NO_ENCONTRADA"


def test_portal_pedir_turno_de_tipo_no_permitido_devuelve_400(client, turnos_portal):
    _login(client, "martin")
    for tipo in ("cirugia", "inactivo"):
        response = client.post(
            "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9), tipo=tipo)
        )
        assert response.status_code == 400
        assert response.json()["error"] in {"TIPO_TURNO_NO_PERMITIDO", "TIPO_TURNO_INACTIVO"}
    cirugia = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9), tipo="cirugia")
    )
    assert cirugia.json()["error"] == "TIPO_TURNO_NO_PERMITIDO"


def test_portal_pedir_turno_para_hoy_devuelve_400_y_pide_comunicarse(client, turnos_portal):
    _login(client, "martin")
    hoy = datetime.now(TZ).replace(hour=23, minute=30, second=0, microsecond=0)
    response = client.post("/api/portal/turnos", json=_pedido(turnos_portal, inicio=hoy))

    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_PORTAL_DESDE_MANANA"
    assert "comunicate con la clínica" in response.json()["detalle"]


def test_portal_pedir_turno_en_horario_ocupado_devuelve_409(client, turnos_portal):
    _login(client, "carla")
    inicio = _proximo(0, 9)
    assert client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=inicio, mascota="thor")
    ).status_code == 201

    _login(client, "martin")
    response = client.post("/api/portal/turnos", json=_pedido(turnos_portal, inicio=inicio))
    assert response.status_code == 409


def test_portal_disponibilidad_devuelve_solo_horarios_libres_sin_datos_de_otros(
    client, turnos_portal
):
    inicio = _proximo(0, 9)
    _login(client, "carla")
    client.post("/api/portal/turnos", json=_pedido(turnos_portal, inicio=inicio, mascota="thor"))

    _login(client, "martin")
    params = {
        "mascota_id": turnos_portal["coco"].id,
        "veterinario_id": turnos_portal["vale"].id,
        "tipo_turno_id": turnos_portal["tipos"]["consulta"].id,
        "fecha": inicio.date().isoformat(),
    }
    response = client.get("/api/portal/turnos/disponibilidad", params=params)

    assert response.status_code == 200
    horarios = response.json()["horarios"]
    assert horarios
    inicios = {datetime.fromisoformat(h["fecha_hora_inicio"].replace("Z", "+00:00"))
               for h in horarios}
    assert inicio not in inicios
    assert "Thor" not in response.text
    assert _claves(response.json()) & {"motivo", "detalle", "disponible"} == set()


def test_portal_disponibilidad_para_hoy_devuelve_400(client, turnos_portal):
    _login(client, "martin")
    params = {
        "mascota_id": turnos_portal["coco"].id,
        "veterinario_id": turnos_portal["vale"].id,
        "tipo_turno_id": turnos_portal["tipos"]["consulta"].id,
        "fecha": datetime.now(TZ).date().isoformat(),
    }
    response = client.get("/api/portal/turnos/disponibilidad", params=params)
    assert response.status_code == 400


def test_portal_cancelar_turno_solicitado_propio_lo_cancela(client, turnos_portal):
    _login(client, "martin")
    turno = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9))
    ).json()

    response = client.post(f"/api/portal/turnos/{turno['id']}/cancelar")

    assert response.status_code == 200
    assert response.json()["estado"] == "cancelado"
    assert response.json()["cancelable"] is False


def test_portal_cancelar_turno_confirmado_devuelve_400_y_pide_comunicarse(client, turnos_portal):
    # El próximo turno de Coco del escenario está confirmado por la clínica.
    _login(client, "martin")
    response = client.post(f"/api/portal/turnos/{turnos_portal['proximo'].id}/cancelar")

    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_NO_CANCELABLE"
    listado = client.get("/api/portal/turnos").json()["proximos"]
    assert all(t["cancelable"] is False for t in listado if t["estado"] == "confirmado")


def test_portal_cancelar_turno_ajeno_devuelve_404(client, turnos_portal):
    _login(client, "carla")
    turno = client.post(
        "/api/portal/turnos", json=_pedido(turnos_portal, inicio=_proximo(0, 9), mascota="thor")
    ).json()

    _login(client, "martin")
    response = client.post(f"/api/portal/turnos/{turno['id']}/cancelar")
    assert response.status_code == 404
