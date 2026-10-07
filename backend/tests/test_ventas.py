from __future__ import annotations

from datetime import date
from decimal import Decimal

from app.models.core.persona import Persona
from test_agenda import _login, _seed_usuario
from test_stock import _setup as _setup_stock
from test_stock import collar, crear_producto, mover


def D(value) -> Decimal:
    return Decimal(str(value))


def _setup(client, session) -> dict:
    """Productos creados por depósito; después se loguea el vendedor."""
    s = _setup_stock(client, session)
    s["ivermectina"] = crear_producto(client, s, envases_iniciales=5, stock_minimo=2)
    s["collar"] = collar(client, s, envases_iniciales=3, precio_venta="800")
    s["jeringa"] = crear_producto(
        client, s, nombre="Jeringa 5 ml", unidad="unidad", contenido_envase="1",
        fraccionable=False, precio_venta=None, envases_iniciales=100,
    )
    cliente = Persona(nombre="Ana", apellido="Gomez", dni="30111222", celular="341", es_cliente=True)
    session.add(cliente)
    session.commit()
    session.refresh(cliente)
    s["cliente"] = cliente
    _seed_usuario(session, username="vendedor", permisos=["ventas:registrar", "ventas:ver"], rol_nombre="VENTAS")
    _login(client, "vendedor")
    return s


def vender(client, items, medio_pago="efectivo", **extra):
    return client.post("/api/ventas", json={"items": items, "medio_pago": medio_pago, **extra})


def stock_de(client, session, producto_id: int) -> dict:
    _login(client, "deposito")
    data = client.get(f"/api/stock/productos/{producto_id}").json()
    _login(client, "vendedor")
    return data


def test_registrar_venta_sin_permiso_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    _login(client, "deposito")
    assert vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 1}]).status_code == 403


def test_venta_toma_precio_del_producto_descuenta_cerrados_y_registra_movimientos(client, session) -> None:
    s = _setup(client, session)
    response = vender(
        client,
        [
            {"producto_id": s["ivermectina"]["id"], "cantidad": 2, "precio_unitario": "1"},  # se ignora
            {"producto_id": s["collar"]["id"], "cantidad": 1},
        ],
        medio_pago="debito",
    )
    assert response.status_code == 201, response.text
    venta = response.json()["venta"]
    assert D(venta["total"]) == D("5800")  # 2 x 2500 + 1 x 800
    assert venta["medio_pago"] == "debito"
    assert [(i["producto_nombre"], i["cantidad"], D(i["subtotal"])) for i in venta["items"]] == [
        ("Ivermectina 1% 50 ml", 2, D("5000")),
        ("Collar antipulgas", 1, D("800")),
    ]
    assert response.json()["advertencias"] == []
    assert stock_de(client, session, s["ivermectina"]["id"])["envases_cerrados"] == 3

    _login(client, "deposito")
    movs = client.get("/api/stock/movimientos", params={"tipo": "venta"}).json()["items"]
    assert {m["venta_id"] for m in movs} == {venta["id"]}
    assert {m["destino"] for m in movs} == {"petshop"}


def test_venta_de_producto_sin_precio_devuelve_400_y_no_toca_el_stock(client, session) -> None:
    s = _setup(client, session)
    response = vender(
        client,
        [{"producto_id": s["collar"]["id"], "cantidad": 1}, {"producto_id": s["jeringa"]["id"], "cantidad": 1}],
    )
    assert response.status_code == 400
    assert response.json()["error"] == "PRODUCTO_NO_VENDIBLE"
    assert stock_de(client, session, s["collar"]["id"])["envases_cerrados"] == 3
    assert client.get("/api/ventas").json()["total"] == 0


def test_venta_de_producto_dado_de_baja_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    _login(client, "deposito")
    client.patch(f"/api/stock/productos/{s['collar']['id']}", json={"activo": False})
    _login(client, "vendedor")
    response = vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 1}])
    assert response.status_code == 400
    assert response.json()["error"] == "PRODUCTO_INACTIVO"


def test_venta_mayor_al_stock_se_permite_queda_en_cero_y_avisa_error_de_stock(client, session) -> None:
    s = _setup(client, session)
    response = vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 4}])
    assert response.status_code == 201
    venta = response.json()["venta"]
    assert venta["items"][0]["cantidad"] == 4  # la venta se registra completa
    assert any("Hay un error en el stock de Collar antipulgas" in a for a in response.json()["advertencias"])
    producto = stock_de(client, session, s["collar"]["id"])
    assert producto["envases_cerrados"] == 0
    assert producto["requiere_revision"] is True


def test_venta_bajo_el_minimo_avisa(client, session) -> None:
    s = _setup(client, session)
    response = vender(client, [{"producto_id": s["ivermectina"]["id"], "cantidad": 4}])
    assert any("por debajo del mínimo" in a for a in response.json()["advertencias"])


def test_mismo_producto_en_dos_lineas_se_suma(client, session) -> None:
    s = _setup(client, session)
    venta = vender(
        client,
        [{"producto_id": s["collar"]["id"], "cantidad": 1}, {"producto_id": s["collar"]["id"], "cantidad": 2}],
    ).json()["venta"]
    assert [(i["cantidad"]) for i in venta["items"]] == [3]
    assert D(venta["total"]) == D("2400")


def test_venta_con_cliente_guarda_el_nombre_y_cliente_inexistente_devuelve_404(client, session) -> None:
    s = _setup(client, session)
    item = [{"producto_id": s["collar"]["id"], "cantidad": 1}]
    assert vender(client, item, persona_id=9999).status_code == 404
    venta = vender(client, item, persona_id=s["cliente"].id).json()["venta"]
    assert venta["cliente_nombre"] == "Ana Gomez"


def test_venta_medio_de_pago_invalido_o_sin_items_devuelve_422(client, session) -> None:
    s = _setup(client, session)
    assert vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 1}], medio_pago="bitcoin").status_code == 422
    assert vender(client, []).status_code == 422
    assert vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 0}]).status_code == 422


def test_listar_y_ver_detalle_de_ventas(client, session) -> None:
    s = _setup(client, session)
    vender(client, [{"producto_id": s["collar"]["id"], "cantidad": 1}])
    segunda = vender(
        client,
        [{"producto_id": s["collar"]["id"], "cantidad": 1}, {"producto_id": s["ivermectina"]["id"], "cantidad": 1}],
        medio_pago="transferencia",
    ).json()["venta"]
    listado = client.get("/api/ventas").json()
    assert listado["total"] == 2
    assert listado["items"][0]["id"] == segunda["id"]  # más reciente primero
    assert listado["items"][0]["cantidad_items"] == 2
    detalle = client.get(f"/api/ventas/{segunda['id']}").json()
    assert detalle["usuario_username"] == "vendedor"
    assert client.get("/api/ventas/9999").status_code == 404


def test_ver_ventas_sin_permiso_devuelve_403(client, session) -> None:
    _setup(client, session)
    _login(client, "deposito")
    assert client.get("/api/ventas").status_code == 403


def test_buscar_clientes_por_apellido_o_dni(client, session) -> None:
    _setup(client, session)
    assert [c["apellido"] for c in client.get("/api/ventas/clientes", params={"q": "gom"}).json()] == ["Gomez"]
    assert len(client.get("/api/ventas/clientes", params={"q": "30111"}).json()) == 1
    assert client.get("/api/ventas/clientes", params={"q": "g"}).json() == []


def test_analisis_separa_uso_petshop_y_consultorio_por_producto_y_rubro(client, session) -> None:
    s = _setup(client, session)
    vender(client, [{"producto_id": s["ivermectina"]["id"], "cantidad": 2}])
    _login(client, "deposito")
    mover(
        client, tipo="consumo_clinico", producto_id=s["ivermectina"]["id"],
        cantidad="2.5", envases_abiertos_nuevos=1,
    )
    data = client.get("/api/stock/analisis").json()
    uso = {u["producto_nombre"]: u for u in data["uso_por_producto"]}["Ivermectina 1% 50 ml"]
    assert D(uso["petshop_envases"]) == D("2")
    assert D(uso["consultorio_envases"]) == D("0.05")
    rubro = {r["rubro_nombre"]: r for r in data["uso_por_rubro"]}["Medicamento"]
    assert D(rubro["petshop_envases"]) == D("2")
    assert D(rubro["consultorio_envases"]) == D("0.05")
    assert date.fromisoformat(data["hasta"][:10]) >= date.today()
