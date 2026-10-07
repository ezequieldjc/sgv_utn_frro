from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from app.models.catalogo.rubro import Rubro
from test_agenda import _login, _seed_usuario
from test_clientes import _seed_jwt_config

PERMISOS_STOCK = [
    "stock:crear_insumo",
    "stock:editar_insumo",
    "stock:registrar_movimiento",
    "stock:ver_movimientos",
    "stock:ver_analisis",
]


def D(value) -> Decimal:
    return Decimal(str(value))


def _setup(client, session) -> dict:
    """Usuario de depósito con todos los permisos de stock, logueado, y rubros base."""
    _seed_jwt_config(session)
    session.commit()
    medicamento = Rubro(nombre="Medicamento", activo=True)
    alimento = Rubro(nombre="Alimento", activo=True)
    viejo = Rubro(nombre="Discontinuado", activo=False)
    session.add_all([medicamento, alimento, viejo])
    session.commit()
    for r in (medicamento, alimento, viejo):
        session.refresh(r)
    deposito = _seed_usuario(session, username="deposito", permisos=PERMISOS_STOCK, rol_nombre="DEPOSITO")
    _login(client, "deposito")
    return {"medicamento": medicamento, "alimento": alimento, "viejo": viejo, "deposito": deposito}


def crear_producto(client, s: dict, **extra) -> dict:
    payload = {
        "nombre": "Ivermectina 1% 50 ml",
        "rubro_id": s["medicamento"].id,
        "unidad": "ml",
        "contenido_envase": "50",
        "fraccionable": True,
        "stock_minimo": 2,
        "precio_costo": "1000",
        "precio_venta": "2500",
        **extra,
    }
    response = client.post("/api/stock/productos", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def collar(client, s: dict, **extra) -> dict:
    return crear_producto(
        client,
        s,
        nombre="Collar antipulgas",
        unidad="unidad",
        contenido_envase="1",
        fraccionable=False,
        stock_minimo=0,
        **extra,
    )


def mover(client, **payload):
    return client.post("/api/stock/movimientos", json=payload)


# ---------------------------------------------------------------------------
# Permisos
# ---------------------------------------------------------------------------


def test_listar_productos_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    assert client.get("/api/stock/productos").status_code == 401


def test_crear_producto_sin_permiso_crear_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    _seed_usuario(session, username="lector", permisos=["stock:ver_movimientos"], rol_nombre="LECTOR")
    _login(client, "lector")
    response = client.post(
        "/api/stock/productos",
        json={"nombre": "X", "rubro_id": s["medicamento"].id, "unidad": "unidad", "contenido_envase": "1"},
    )
    assert response.status_code == 403


def test_registrar_movimiento_sin_permiso_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    _seed_usuario(session, username="lector", permisos=["stock:ver_movimientos"], rol_nombre="LECTOR")
    _login(client, "lector")
    assert mover(client, tipo="compra", producto_id=producto["id"], envases=1).status_code == 403


def test_ver_movimientos_sin_permiso_devuelve_403(client, session) -> None:
    _setup(client, session)
    _seed_usuario(session, username="vende", permisos=["ventas:registrar"], rol_nombre="VENTAS")
    _login(client, "vende")
    assert client.get("/api/stock/movimientos").status_code == 403


def test_vendedor_puede_listar_productos_para_venta(client, session) -> None:
    s = _setup(client, session)
    crear_producto(client, s)
    crear_producto(client, s, nombre="Jeringa 5 ml", precio_venta=None, fraccionable=False, unidad="unidad", contenido_envase="1")
    _seed_usuario(session, username="vende", permisos=["ventas:registrar"], rol_nombre="VENTAS")
    _login(client, "vende")
    response = client.get("/api/stock/productos", params={"para_venta": True})
    assert response.status_code == 200
    assert [p["nombre"] for p in response.json()["items"]] == ["Ivermectina 1% 50 ml"]


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------


def test_crear_producto_con_stock_inicial_registra_ajuste_stock_inicial(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=5, cantidad_abierta_inicial="30")
    assert producto["envases_cerrados"] == 5
    assert D(producto["cantidad_abierta"]) == D("30")
    assert D(producto["stock_equivalente_envases"]) == D("5.6")
    assert producto["se_vende"] is True
    movs = client.get("/api/stock/movimientos", params={"producto_id": producto["id"]}).json()["items"]
    assert len(movs) == 1
    assert movs[0]["tipo"] == "ajuste" and movs[0]["observaciones"] == "Stock inicial"


def test_crear_producto_sin_stock_inicial_no_registra_movimientos(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    movs = client.get("/api/stock/movimientos", params={"producto_id": producto["id"]}).json()
    assert movs["total"] == 0


def test_crear_producto_nombre_duplicado_sin_importar_mayusculas_devuelve_409(client, session) -> None:
    s = _setup(client, session)
    crear_producto(client, s)
    response = client.post(
        "/api/stock/productos",
        json={"nombre": "IVERMECTINA 1% 50 ML", "rubro_id": s["medicamento"].id, "unidad": "ml", "contenido_envase": "50"},
    )
    assert response.status_code == 409


def test_crear_producto_no_fraccionable_con_cantidad_abierta_devuelve_422(client, session) -> None:
    s = _setup(client, session)
    response = client.post(
        "/api/stock/productos",
        json={
            "nombre": "Collar", "rubro_id": s["medicamento"].id, "unidad": "unidad",
            "contenido_envase": "1", "fraccionable": False, "cantidad_abierta_inicial": "1",
        },
    )
    assert response.status_code == 422


def test_crear_producto_con_rubro_inactivo_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    response = client.post(
        "/api/stock/productos",
        json={"nombre": "X", "rubro_id": s["viejo"].id, "unidad": "unidad", "contenido_envase": "1"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "RUBRO_INACTIVO"


def test_editar_producto_quitar_precio_lo_saca_de_la_venta(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    response = client.patch(f"/api/stock/productos/{producto['id']}", json={"precio_venta": None})
    assert response.status_code == 200
    assert response.json()["se_vende"] is False


def test_editar_producto_a_no_fraccionable_con_abiertos_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, cantidad_abierta_inicial="10")
    response = client.patch(f"/api/stock/productos/{producto['id']}", json={"fraccionable": False})
    assert response.status_code == 400
    assert response.json()["error"] == "PRODUCTO_CON_ABIERTOS"


def test_listar_rubros_devuelve_solo_activos(client, session) -> None:
    _setup(client, session)
    nombres = [r["nombre"] for r in client.get("/api/stock/rubros").json()]
    assert nombres == ["Alimento", "Medicamento"]


def test_rubros_aparecen_en_admin_catalogos(client, session) -> None:
    _setup(client, session)
    _seed_usuario(session, username="admin_cat", permisos=["catalogos:ver"], rol_nombre="CAT")
    _login(client, "admin_cat")
    response = client.get("/api/catalogos/rubros", params={"activo": "all"})
    assert response.status_code == 200
    assert {r["nombre"] for r in response.json()} == {"Medicamento", "Alimento", "Discontinuado"}


# ---------------------------------------------------------------------------
# Movimientos
# ---------------------------------------------------------------------------


def test_compra_suma_envases_cerrados_y_guarda_vencimiento(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    vence = (date.today() + timedelta(days=200)).isoformat()
    response = mover(client, tipo="compra", producto_id=producto["id"], envases=10, fecha_vencimiento=vence)
    assert response.status_code == 201
    data = response.json()
    assert data["producto"]["envases_cerrados"] == 10
    assert data["movimiento"]["delta_envases_cerrados"] == 10
    assert data["movimiento"]["fecha_vencimiento"] == vence
    assert data["movimiento"]["destino"] is None
    assert data["advertencias"] == []


def test_consumo_de_envase_ya_abierto_descuenta_solo_lo_abierto(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=3, cantidad_abierta_inicial="20")
    data = mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2.5").json()
    assert data["producto"]["envases_cerrados"] == 3
    assert D(data["producto"]["cantidad_abierta"]) == D("17.5")
    assert data["movimiento"]["destino"] == "consultorio"
    assert data["advertencias"] == []


def test_consumo_abriendo_envase_nuevo_pasa_un_cerrado_a_abierto(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=3)
    data = mover(
        client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2.5", envases_abiertos_nuevos=1
    ).json()
    assert data["producto"]["envases_cerrados"] == 2
    assert D(data["producto"]["cantidad_abierta"]) == D("47.5")
    assert data["movimiento"]["delta_envases_cerrados"] == -1
    assert D(data["movimiento"]["delta_cantidad_abierta"]) == D("47.5")


def test_consumo_ya_abierto_sin_cantidad_suficiente_deja_abierto_en_cero_y_marca_revision(
    client, session
) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=3, cantidad_abierta_inicial="1")
    response = mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2.5")
    assert response.status_code == 201
    data = response.json()
    assert data["producto"]["envases_cerrados"] == 3  # nunca abre envases por su cuenta
    assert D(data["producto"]["cantidad_abierta"]) == D("0")
    assert data["producto"]["requiere_revision"] is True
    assert "REVISAR_STOCK" in data["producto"]["alertas"]
    assert D(data["movimiento"]["delta_cantidad_abierta"]) == D("-2.5")  # se registra lo real
    assert any("faltaba 1,5 ml abiertos" in a for a in data["advertencias"])


def test_consumo_producto_no_fraccionable_se_carga_en_envases_enteros(client, session) -> None:
    s = _setup(client, session)
    producto = collar(client, s, envases_iniciales=4)
    assert mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="1.5").status_code == 400
    assert (
        mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="1", envases_abiertos_nuevos=1).status_code
        == 400
    )
    data = mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2").json()
    assert data["producto"]["envases_cerrados"] == 2


def test_salida_mayor_al_stock_se_registra_queda_en_cero_y_agrega_ajuste_automatico(
    client, session
) -> None:
    s = _setup(client, session)
    producto = collar(client, s, envases_iniciales=1)
    response = mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="3")
    assert response.status_code == 201
    data = response.json()
    assert data["producto"]["envases_cerrados"] == 0
    assert data["producto"]["alertas"] == ["REVISAR_STOCK"]
    assert data["movimiento"]["delta_envases_cerrados"] == -3
    assert any("Hay un error en el stock" in a and "faltaba 2 envases cerrados" in a for a in data["advertencias"])
    movs = client.get("/api/stock/movimientos", params={"producto_id": producto["id"]}).json()["items"]
    automatico = [m for m in movs if (m["observaciones"] or "").startswith("Ajuste automático")]
    assert len(automatico) == 1 and automatico[0]["delta_envases_cerrados"] == 2
    # El historial sigue explicando el stock: 1 (inicial) - 3 + 2 = 0.
    assert sum(m["delta_envases_cerrados"] for m in movs) == 0


def test_recuento_con_diferencias_quita_la_marca_de_revision(client, session) -> None:
    s = _setup(client, session)
    producto = collar(client, s, envases_iniciales=1)
    mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2")
    data = mover(client, tipo="ajuste", producto_id=producto["id"], envases_cerrados_real=4).json()
    assert data["producto"]["envases_cerrados"] == 4
    assert data["producto"]["requiere_revision"] is False
    assert data["producto"]["alertas"] == []


def test_recuento_que_coincide_confirma_y_quita_la_marca_sin_movimiento(client, session) -> None:
    s = _setup(client, session)
    producto = collar(client, s, envases_iniciales=1)
    mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2")
    response = mover(client, tipo="ajuste", producto_id=producto["id"], envases_cerrados_real=0)
    assert response.status_code == 201
    data = response.json()
    assert data["movimiento"] is None
    assert data["producto"]["requiere_revision"] is False
    assert any("Recuento confirmado" in a for a in data["advertencias"])


def test_baja_por_rotura_mayor_al_stock_queda_en_cero_y_marca_revision(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=1, stock_minimo=0)
    data = mover(client, tipo="vencimiento_rotura", producto_id=producto["id"], envases=2).json()
    assert data["producto"]["envases_cerrados"] == 0
    assert data["producto"]["requiere_revision"] is True


def test_baja_que_deja_bajo_el_minimo_avisa(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=3, stock_minimo=3)
    data = mover(client, tipo="vencimiento_rotura", producto_id=producto["id"], envases=1).json()
    assert data["producto"]["alertas"] == ["BAJO_MINIMO"]
    assert any("por debajo del mínimo" in a for a in data["advertencias"])


def test_vencimiento_rotura_descuenta_cerrados_y_abierto(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=5, cantidad_abierta_inicial="30", stock_minimo=0)
    data = mover(
        client, tipo="vencimiento_rotura", producto_id=producto["id"], envases=2, cantidad_abierta="30"
    ).json()
    assert data["producto"]["envases_cerrados"] == 3
    assert D(data["producto"]["cantidad_abierta"]) == D("0")


def test_vencimiento_rotura_sin_cantidades_devuelve_422(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    assert mover(client, tipo="vencimiento_rotura", producto_id=producto["id"]).status_code == 422


def test_ajuste_por_recuento_calcula_diferencias_en_ambos_sentidos(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=8, cantidad_abierta_inicial="20")
    data = mover(
        client, tipo="ajuste", producto_id=producto["id"], envases_cerrados_real=10, cantidad_abierta_real="5"
    ).json()
    assert data["movimiento"]["delta_envases_cerrados"] == 2
    assert D(data["movimiento"]["delta_cantidad_abierta"]) == D("-15")
    assert data["producto"]["envases_cerrados"] == 10
    assert D(data["producto"]["cantidad_abierta"]) == D("5")


def test_ajuste_sin_diferencias_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=8)
    response = mover(client, tipo="ajuste", producto_id=producto["id"], envases_cerrados_real=8)
    assert response.status_code == 400
    assert response.json()["error"] == "SIN_DIFERENCIAS"


def test_movimiento_tipo_venta_no_se_registra_desde_stock(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    assert mover(client, tipo="venta", producto_id=producto["id"], envases=1).status_code == 422


def test_producto_dado_de_baja_solo_admite_ajustes(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=2)
    client.patch(f"/api/stock/productos/{producto['id']}", json={"activo": False})
    response = mover(client, tipo="compra", producto_id=producto["id"], envases=1)
    assert response.status_code == 400
    assert response.json()["error"] == "PRODUCTO_INACTIVO"
    assert mover(client, tipo="ajuste", producto_id=producto["id"], envases_cerrados_real=0).status_code == 201


def test_movimiento_producto_inexistente_devuelve_404(client, session) -> None:
    _setup(client, session)
    assert mover(client, tipo="compra", producto_id=9999, envases=1).status_code == 404


def test_listar_movimientos_filtra_por_tipo_y_ordena_del_mas_reciente(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s)
    mover(client, tipo="compra", producto_id=producto["id"], envases=5)
    mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="1", envases_abiertos_nuevos=1)
    mover(client, tipo="compra", producto_id=producto["id"], envases=2)
    compras = client.get("/api/stock/movimientos", params={"tipo": "compra"}).json()
    assert compras["total"] == 2
    assert [m["delta_envases_cerrados"] for m in compras["items"]] == [2, 5]
    assert compras["items"][0]["usuario_username"] == "deposito"


def test_listar_productos_con_alerta_devuelve_solo_los_que_tienen_alertas(client, session) -> None:
    s = _setup(client, session)
    crear_producto(client, s, envases_iniciales=1, stock_minimo=3)  # bajo mínimo
    collar(client, s, envases_iniciales=10)
    nombres = [p["nombre"] for p in client.get("/api/stock/productos", params={"con_alerta": True}).json()["items"]]
    assert nombres == ["Ivermectina 1% 50 ml"]


# ---------------------------------------------------------------------------
# Análisis
# ---------------------------------------------------------------------------


def test_analisis_requiere_permiso_ver_analisis(client, session) -> None:
    _setup(client, session)
    _seed_usuario(session, username="lector", permisos=["stock:ver_movimientos"], rol_nombre="LECTOR")
    _login(client, "lector")
    assert client.get("/api/stock/analisis").status_code == 403


def test_analisis_muestra_alertas_vencimientos_y_valor_del_inventario(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, stock_minimo=5)
    mover(
        client, tipo="compra", producto_id=producto["id"], envases=4,
        fecha_vencimiento=(date.today() + timedelta(days=10)).isoformat(),
    )
    mover(
        client, tipo="compra", producto_id=producto["id"], envases=1,
        fecha_vencimiento=(date.today() + timedelta(days=300)).isoformat(),
    )
    sin_stock = collar(client, s)
    mover(client, tipo="consumo_clinico", producto_id=sin_stock["id"], cantidad="1")

    data = client.get("/api/stock/analisis").json()
    alertas = data["alertas"]
    assert [p["nombre"] for p in alertas["bajo_minimo"]] == []  # 5 cerrados = mínimo 5
    assert [p["nombre"] for p in alertas["revisar_stock"]] == ["Collar antipulgas"]
    assert [v["envases_ingresados"] for v in alertas["proximos_vencimientos"]] == [4]
    assert alertas["dias_alerta_vencimiento"] == 30
    assert D(data["valor_inventario_costo"]) == D("5000")  # 5 envases x costo 1000
    assert data["productos_activos"] == 2


def test_analisis_consumo_clinico_cuenta_lo_usado_no_lo_abierto(client, session) -> None:
    s = _setup(client, session)
    producto = crear_producto(client, s, envases_iniciales=3)
    mover(client, tipo="consumo_clinico", producto_id=producto["id"], cantidad="2.5", envases_abiertos_nuevos=1)
    uso = client.get("/api/stock/analisis").json()["uso_por_producto"]
    assert len(uso) == 1
    assert D(uso[0]["consultorio_cantidad"]) == D("2.5")
    assert D(uso[0]["consultorio_envases"]) == D("0.05")
    assert D(uso[0]["petshop_envases"]) == D("0")
