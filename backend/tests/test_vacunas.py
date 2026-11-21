from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.agenda.tipo_turno import TipoTurno
from app.models.agenda.turno import Turno
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.rubro import Rubro
from app.models.clinica.mascota import Mascota
from test_agenda import TZ, _login, _seed_mascota, _seed_usuario
from test_stock import _setup as _setup_stock
from test_stock import crear_producto

PERMISOS_VET = ["vacunas:registrar", "vacunas:ver"]


def D(value) -> Decimal:
    return Decimal(str(value))


def _hoy():
    return datetime.now(TZ).date()


def _escenario(client, session) -> dict:
    """Depósito carga vacunas y antiparasitarios; queda logueada la veterinaria."""
    s = _setup_stock(client, session)
    vacuna = Rubro(nombre="Vacuna", activo=True)
    antiparasitario = Rubro(nombre="Antiparasitario", activo=True)
    session.add_all([vacuna, antiparasitario])
    session.commit()
    session.refresh(vacuna)
    session.refresh(antiparasitario)
    unidad = {"unidad": "unidad", "contenido_envase": "1", "fraccionable": False, "stock_minimo": 0}
    s["antirrabica"] = crear_producto(
        client, s, nombre="Vacuna Antirrábica", rubro_id=vacuna.id, precio_venta="12000",
        envases_iniciales=5, **unidad,
    )
    s["sextuple_sin_precio"] = crear_producto(
        client, s, nombre="Vacuna Séxtuple", rubro_id=vacuna.id, precio_venta=None,
        envases_iniciales=3, **unidad,
    )
    s["antiparasitario"] = crear_producto(
        client, s, nombre="Antiparasitario interno", rubro_id=antiparasitario.id,
        precio_venta="3000", envases_iniciales=10, **unidad,
    )
    s["ivermectina"] = crear_producto(client, s)  # rubro Medicamento: no es preventivo
    s["felipe"] = _seed_mascota(session, nombre="Felipe", tutor_apellido="Ferreyra")
    s["vet"] = _seed_usuario(
        session, username="vet", permisos=PERMISOS_VET, rol_nombre="VETERINARIO",
        nombre="Valeria", apellido="Sosa",
    )
    _login(client, "vet")
    return s


def aplicar(client, s: dict, producto: str = "antirrabica", **extra):
    payload = {
        "mascota_id": s["felipe"].id,
        "tipo": "vacunacion",
        "modo": "aplicar",
        "producto_id": s[producto]["id"],
        "fecha_proxima_dosis": (_hoy() + timedelta(days=365)).isoformat(),
        **extra,
    }
    return client.post("/api/vacunas", json=payload)


def anterior(client, s: dict, *, dias_atras: int, proxima_en: int | None, **extra):
    hoy = _hoy()
    payload = {
        "mascota_id": s["felipe"].id,
        "tipo": "vacunacion",
        "modo": "anterior",
        "nombre_producto": "Séxtuple (libreta)",
        "fecha_aplicacion": (hoy - timedelta(days=dias_atras)).isoformat(),
        "fecha_proxima_dosis": (
            (hoy + timedelta(days=proxima_en)).isoformat() if proxima_en is not None else None
        ),
        **extra,
    }
    return client.post("/api/vacunas", json=payload)


def stock_de(client, producto_id: int) -> int:
    _login(client, "deposito")
    cerrados = client.get(f"/api/stock/productos/{producto_id}").json()["envases_cerrados"]
    _login(client, "vet")
    return cerrados


def carnet(client, s: dict) -> dict:
    response = client.get("/api/vacunas", params={"mascota_id": s["felipe"].id})
    assert response.status_code == 200, response.text
    return response.json()


# ---------------------------------------------------------------------------
# Aplicar en la clínica
# ---------------------------------------------------------------------------


def test_aplicar_y_cobrar_descuenta_stock_y_arma_la_venta_al_tutor(client, session) -> None:
    s = _escenario(client, session)
    response = aplicar(client, s, cobrar=True, medio_pago="efectivo", lote="AR-2291")
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["venta_id"] is not None
    assert D(data["venta_total"]) == D("12000")
    item = data["item"]
    assert item["aplicada_en_clinica"] is True
    assert item["nombre_producto"] == "Vacuna Antirrábica"
    assert item["fecha_aplicacion"] == _hoy().isoformat()
    assert item["estado_dosis"] == "al_dia"
    assert item["lote"] == "AR-2291"
    assert item["usuario_nombre"] == "Valeria Sosa"
    assert stock_de(client, s["antirrabica"]["id"]) == 4

    _login(client, "deposito")
    movs = client.get("/api/stock/movimientos", params={"tipo": "venta"}).json()["items"]
    assert [m["venta_id"] for m in movs] == [data["venta_id"]]


def test_aplicar_sin_cobrar_es_consumo_clinico(client, session) -> None:
    s = _escenario(client, session)
    data = aplicar(client, s).json()
    assert data["venta_id"] is None
    assert stock_de(client, s["antirrabica"]["id"]) == 4
    _login(client, "deposito")
    movs = client.get("/api/stock/movimientos", params={"tipo": "consumo_clinico"}).json()["items"]
    assert len(movs) == 1
    assert movs[0]["destino"] == "consultorio"


def test_aplicar_actualiza_el_ultimo_peso_de_la_mascota(client, session) -> None:
    s = _escenario(client, session)
    assert aplicar(client, s, peso_kg="21.5").status_code == 201
    session.expire_all()
    assert session.get(Mascota, s["felipe"].id).ultimo_peso == D("21.50")


def test_cobrar_un_producto_sin_precio_no_registra_nada(client, session) -> None:
    s = _escenario(client, session)
    response = aplicar(client, s, producto="sextuple_sin_precio", cobrar=True, medio_pago="debito")
    assert response.status_code == 400
    assert response.json()["error"] == "PRODUCTO_NO_VENDIBLE"
    assert carnet(client, s)["items"] == []
    assert stock_de(client, s["sextuple_sin_precio"]["id"]) == 3


def test_el_producto_tiene_que_ser_del_tipo_indicado(client, session) -> None:
    s = _escenario(client, session)
    no_preventivo = aplicar(client, s, producto="ivermectina")
    assert no_preventivo.status_code == 400
    assert no_preventivo.json()["error"] == "PRODUCTO_NO_PREVENTIVO"
    otro_tipo = aplicar(client, s, producto="antirrabica", tipo="desparasitacion")
    assert otro_tipo.status_code == 400
    assert aplicar(client, s, producto="antiparasitario", tipo="desparasitacion").status_code == 201


def test_aplicar_con_otra_fecha_o_sin_producto_falla(client, session) -> None:
    s = _escenario(client, session)
    ayer = (_hoy() - timedelta(days=1)).isoformat()
    response = aplicar(client, s, fecha_aplicacion=ayer)
    assert response.status_code == 400
    assert response.json()["error"] == "FECHA_APLICACION_INVALIDA"
    sin_producto = client.post(
        "/api/vacunas",
        json={"mascota_id": s["felipe"].id, "tipo": "vacunacion", "modo": "aplicar"},
    )
    assert sin_producto.status_code == 422
    sin_medio = aplicar(client, s, cobrar=True)
    assert sin_medio.status_code == 422


def test_proxima_dosis_tiene_que_ser_posterior(client, session) -> None:
    s = _escenario(client, session)
    response = aplicar(client, s, fecha_proxima_dosis=_hoy().isoformat())
    assert response.status_code == 400
    assert response.json()["error"] == "FECHA_PROXIMA_INVALIDA"
    sin_refuerzo = aplicar(client, s, fecha_proxima_dosis=None).json()["item"]
    assert sin_refuerzo["estado_dosis"] == "sin_refuerzo"
    assert sin_refuerzo["dias_para_vencer"] is None


# ---------------------------------------------------------------------------
# Dosis anteriores y refuerzos
# ---------------------------------------------------------------------------


def test_dosis_anterior_queda_registrada_sin_mover_stock(client, session) -> None:
    s = _escenario(client, session)
    response = anterior(client, s, dias_atras=360, proxima_en=5, lote="L-77")
    assert response.status_code == 201, response.text
    item = response.json()["item"]
    assert item["aplicada_en_clinica"] is False
    assert item["producto_id"] is None
    assert item["estado_dosis"] == "por_vencer"
    assert item["dias_para_vencer"] == 5
    vencida = anterior(client, s, dias_atras=400, proxima_en=-3).json()["item"]
    assert vencida["estado_dosis"] == "vencida"
    assert vencida["dias_para_vencer"] == -3
    assert stock_de(client, s["antirrabica"]["id"]) == 5


def test_dosis_anterior_no_puede_ser_futura_ni_cobrarse(client, session) -> None:
    s = _escenario(client, session)
    futura = anterior(client, s, dias_atras=-2, proxima_en=300)
    assert futura.status_code == 400
    assert futura.json()["error"] == "FECHA_APLICACION_INVALIDA"
    cobrada = anterior(client, s, dias_atras=10, proxima_en=300, cobrar=True, medio_pago="efectivo")
    assert cobrada.status_code == 422


def test_el_refuerzo_completa_la_dosis_anterior(client, session) -> None:
    s = _escenario(client, session)
    previa = anterior(client, s, dias_atras=362, proxima_en=3).json()["item"]
    refuerzo = aplicar(client, s, refuerzo_de_id=previa["id"])
    assert refuerzo.status_code == 201, refuerzo.text

    items = {i["id"]: i for i in carnet(client, s)["items"]}
    assert items[previa["id"]]["estado_dosis"] == "reforzada"
    assert items[previa["id"]]["reforzada_por_id"] == refuerzo.json()["item"]["id"]

    otra_vez = aplicar(client, s, refuerzo_de_id=previa["id"])
    assert otra_vez.status_code == 409
    assert otra_vez.json()["error"] == "DOSIS_YA_REFORZADA"


def test_el_refuerzo_tiene_que_ser_del_mismo_tipo_y_posterior(client, session) -> None:
    s = _escenario(client, session)
    previa = anterior(client, s, dias_atras=100, proxima_en=10).json()["item"]
    otro_tipo = aplicar(
        client, s, producto="antiparasitario", tipo="desparasitacion", refuerzo_de_id=previa["id"]
    )
    assert otro_tipo.status_code == 400
    assert otro_tipo.json()["error"] == "REFUERZO_DE_OTRO_TIPO"
    mas_vieja = anterior(client, s, dias_atras=200, proxima_en=None, refuerzo_de_id=previa["id"])
    assert mas_vieja.status_code == 400
    assert mas_vieja.json()["error"] == "REFUERZO_ANTERIOR_A_LA_DOSIS"


def test_el_carnet_lista_de_la_mas_reciente_a_la_mas_antigua(client, session) -> None:
    s = _escenario(client, session)
    anterior(client, s, dias_atras=400, proxima_en=None)
    anterior(client, s, dias_atras=30, proxima_en=60)
    aplicar(client, s)
    data = carnet(client, s)
    assert [i["fecha_aplicacion"] for i in data["items"]] == sorted(
        (i["fecha_aplicacion"] for i in data["items"]), reverse=True
    )
    assert data["mascota"]["nombre"] == "Felipe"
    assert data["mascota"]["atendible"] is True
    assert data["config"]["dias_refuerzo_vacuna"] == 365
    assert data["hoy"] == _hoy().isoformat()


# ---------------------------------------------------------------------------
# Turno, mascota y permisos
# ---------------------------------------------------------------------------


def _turno_vacunacion(session, s: dict, mascota_id: int, estado: str = "confirmado") -> Turno:
    tipo = TipoTurno(nombre="Vacunación", duracion_min=30, activo=True)
    session.add(tipo)
    session.flush()
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=1)
    turno = Turno(
        mascota_id=mascota_id,
        veterinario_id=s["vet"].id,
        tipo_turno_id=tipo.id or 0,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=inicio + timedelta(minutes=30),
        estado=estado,
        canal_origen="mostrador",
    )
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno


def test_vacunar_desde_el_turno_lo_marca_atendido(client, session) -> None:
    s = _escenario(client, session)
    turno = _turno_vacunacion(session, s, s["felipe"].id)
    data = aplicar(client, s, turno_id=turno.id).json()
    assert data["turno_atendido"] is True
    assert data["item"]["turno_id"] == turno.id
    session.expire_all()
    assert session.get(Turno, turno.id).estado == "atendido"


def test_turno_de_otra_mascota_o_cancelado_falla(client, session) -> None:
    s = _escenario(client, session)
    otra = _seed_mascota(session, nombre="Simón", tutor_apellido="Ferreyra")
    ajeno = _turno_vacunacion(session, s, otra.id)
    response = aplicar(client, s, turno_id=ajeno.id)
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_DE_OTRA_MASCOTA"
    cancelado = Turno(
        mascota_id=s["felipe"].id,
        veterinario_id=s["vet"].id,
        tipo_turno_id=ajeno.tipo_turno_id,
        fecha_hora_inicio=ajeno.fecha_hora_inicio + timedelta(days=2),
        fecha_hora_fin=ajeno.fecha_hora_fin + timedelta(days=2),
        estado="cancelado",
        canal_origen="mostrador",
    )
    session.add(cancelado)
    session.commit()
    response = aplicar(client, s, turno_id=cancelado.id)
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_NO_ATENDIBLE"


def test_mascota_fallecida_no_recibe_vacunas(client, session) -> None:
    s = _escenario(client, session)
    obito = MascotaEstado(nombre="Óbito (Natural/Trauma)", activo=True)
    session.add(obito)
    session.flush()
    mascota = session.get(Mascota, s["felipe"].id)
    mascota.mascota_estado_id = obito.id
    session.add(mascota)
    session.commit()
    response = aplicar(client, s)
    assert response.status_code == 400
    assert response.json()["error"] == "MASCOTA_NO_ATENDIBLE"
    assert carnet(client, s)["mascota"]["atendible"] is False


def test_productos_preventivos_solo_vacunas_y_antiparasitarios(client, session) -> None:
    s = _escenario(client, session)
    productos = client.get("/api/vacunas/productos").json()
    assert {(p["nombre"], p["tipo"]) for p in productos} == {
        ("Antiparasitario interno", "desparasitacion"),
        ("Vacuna Antirrábica", "vacunacion"),
        ("Vacuna Séxtuple", "vacunacion"),
    }


def test_permisos(client, session) -> None:
    s = _escenario(client, session)
    _seed_usuario(session, username="recep", permisos=["vacunas:ver"], rol_nombre="RECEPCION")
    _seed_usuario(session, username="nadie", permisos=["agenda:ver"], rol_nombre="OTRO")
    _login(client, "recep")
    assert carnet(client, s)["items"] == []
    assert aplicar(client, s).status_code == 403
    assert client.get("/api/vacunas/productos").status_code == 403
    _login(client, "nadie")
    assert client.get("/api/vacunas", params={"mascota_id": s["felipe"].id}).status_code == 403
