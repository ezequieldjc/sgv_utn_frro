from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.models.auth.usuario import Usuario
from app.models.catalogo.rubro import Rubro
from app.models.stock.movimiento_stock import MovimientoStock
from app.models.stock.producto import Producto
from app.schemas.stock import (
    AjusteIn,
    AlertasStock,
    AnalisisResponse,
    CompraIn,
    ConsumoClinicoIn,
    MovimientoItem,
    MovimientoListResponse,
    MovimientoResultado,
    ProductoCreate,
    ProductoItem,
    ProductoListResponse,
    ProductoUpdate,
    RubroOpcion,
    UsoProductoItem,
    UsoRubroItem,
    VencimientoItem,
    VencimientoRoturaIn,
)
from app.services.config_service import get_config_value

DESTINO_POR_TIPO = {"venta": "petshop", "consumo_clinico": "consultorio"}

CONFIG_STOCK_ID = 5
PARAM_DIAS_ALERTA_VENCIMIENTO = 1
DEFAULT_DIAS_ALERTA_VENCIMIENTO = "30"
DIAS_VENCIDOS_VISIBLES = 30

CANTIDAD = Decimal("0.001")
ENVASES = Decimal("0.01")


def _q(value: Decimal) -> Decimal:
    return Decimal(value).quantize(CANTIDAD)


def _fmt(value: Decimal) -> str:
    """Decimal sin ceros de más, con coma decimal: 47.500 -> '47,5'."""
    texto = format(Decimal(value).normalize(), "f")
    return texto.replace(".", ",")


# ---------------------------------------------------------------------------
# Productos
# ---------------------------------------------------------------------------


def equivalente_envases(producto: Producto) -> Decimal:
    total = Decimal(producto.envases_cerrados) + Decimal(producto.cantidad_abierta) / Decimal(
        producto.contenido_envase
    )
    return total.quantize(ENVASES)


def alertas_producto(producto: Producto) -> list[str]:
    alertas: list[str] = []
    if producto.requiere_revision:
        alertas.append("REVISAR_STOCK")
    if producto.stock_minimo > 0 and producto.envases_cerrados < producto.stock_minimo:
        alertas.append("BAJO_MINIMO")
    return alertas


def _to_item(producto: Producto, rubro_nombre: str) -> ProductoItem:
    return ProductoItem(
        id=producto.id or 0,
        nombre=producto.nombre,
        rubro_id=producto.rubro_id,
        rubro_nombre=rubro_nombre,
        proveedor=producto.proveedor,
        unidad=producto.unidad,
        contenido_envase=_q(producto.contenido_envase),
        fraccionable=producto.fraccionable,
        envases_cerrados=producto.envases_cerrados,
        cantidad_abierta=_q(producto.cantidad_abierta),
        stock_equivalente_envases=equivalente_envases(producto),
        stock_minimo=producto.stock_minimo,
        precio_costo=producto.precio_costo,
        precio_venta=producto.precio_venta,
        se_vende=producto.precio_venta is not None,
        activo=producto.activo,
        requiere_revision=producto.requiere_revision,
        alertas=alertas_producto(producto),
    )


def _item(session: Session, producto: Producto) -> ProductoItem:
    rubro = session.get(Rubro, producto.rubro_id)
    return _to_item(producto, rubro.nombre if rubro else "")


def list_rubros_activos(session: Session) -> list[RubroOpcion]:
    rows = session.exec(select(Rubro).where(Rubro.activo.is_(True)).order_by(Rubro.nombre)).all()
    return [RubroOpcion(id=r.id or 0, nombre=r.nombre) for r in rows]


def _validar_rubro(session: Session, rubro_id: int) -> None:
    rubro = session.get(Rubro, rubro_id)
    if rubro is None:
        raise APIError(404, "RUBRO_NO_ENCONTRADO", "No se encontró el rubro indicado")
    if not rubro.activo:
        raise APIError(400, "RUBRO_INACTIVO", "El rubro indicado no está activo")


def _validar_nombre_unico(session: Session, nombre: str, excluir_id: int | None = None) -> None:
    stmt = select(Producto.id).where(func.lower(Producto.nombre) == nombre.lower())
    if excluir_id is not None:
        stmt = stmt.where(Producto.id != excluir_id)
    if session.exec(stmt).first() is not None:
        raise APIError(409, "PRODUCTO_DUPLICADO", "Ya existe un producto con ese nombre")


def list_productos(
    session: Session,
    *,
    q: str | None = None,
    rubro_id: int | None = None,
    activo: bool | None = True,
    con_alerta: bool = False,
    para_venta: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> ProductoListResponse:
    stmt = select(Producto, Rubro.nombre).join(Rubro, Rubro.id == Producto.rubro_id)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(col(Producto.nombre).ilike(like), col(Producto.proveedor).ilike(like)))
    if rubro_id is not None:
        stmt = stmt.where(Producto.rubro_id == rubro_id)
    if activo is not None:
        stmt = stmt.where(Producto.activo.is_(activo))
    if para_venta:
        stmt = stmt.where(col(Producto.precio_venta).is_not(None), Producto.activo.is_(True))
    rows = session.exec(stmt.order_by(Producto.nombre)).all()
    items = [_to_item(p, rubro_nombre) for p, rubro_nombre in rows]
    if con_alerta:
        items = [i for i in items if i.alertas]
    page = max(page, 1)
    page_size = max(min(page_size, 200), 1)
    inicio = (page - 1) * page_size
    return ProductoListResponse(
        items=items[inicio : inicio + page_size], total=len(items), page=page, page_size=page_size
    )


def get_producto_model(session: Session, producto_id: int, *, bloquear: bool = False) -> Producto:
    stmt = select(Producto).where(Producto.id == producto_id)
    if bloquear:
        # Evita que dos movimientos simultáneos lean el mismo saldo (no-op en SQLite).
        stmt = stmt.with_for_update()
    producto = session.exec(stmt).first()
    if producto is None:
        raise APIError(404, "PRODUCTO_NO_ENCONTRADO", "No se encontró el producto indicado")
    return producto


def get_producto(session: Session, producto_id: int) -> ProductoItem:
    return _item(session, get_producto_model(session, producto_id))


def create_producto(session: Session, payload: ProductoCreate, usuario_id: int) -> ProductoItem:
    _validar_rubro(session, payload.rubro_id)
    _validar_nombre_unico(session, payload.nombre)
    producto = Producto(
        nombre=payload.nombre,
        rubro_id=payload.rubro_id,
        proveedor=payload.proveedor,
        unidad=payload.unidad,
        contenido_envase=payload.contenido_envase,
        fraccionable=payload.fraccionable,
        stock_minimo=payload.stock_minimo,
        precio_costo=payload.precio_costo,
        precio_venta=payload.precio_venta,
    )
    session.add(producto)
    session.flush()
    if payload.envases_iniciales > 0 or payload.cantidad_abierta_inicial > 0:
        aplicar_movimiento(
            session,
            producto,
            tipo="ajuste",
            delta_cerrados=payload.envases_iniciales,
            delta_abierta=payload.cantidad_abierta_inicial,
            usuario_id=usuario_id,
            observaciones="Stock inicial",
        )
    _commit(session)
    session.refresh(producto)
    return _item(session, producto)


def update_producto(session: Session, producto_id: int, payload: ProductoUpdate) -> ProductoItem:
    producto = get_producto_model(session, producto_id)
    datos = payload.model_dump(exclude_unset=True)
    if "nombre" in datos and datos["nombre"] is not None:
        _validar_nombre_unico(session, datos["nombre"], excluir_id=producto.id)
    if "rubro_id" in datos and datos["rubro_id"] is not None and datos["rubro_id"] != producto.rubro_id:
        _validar_rubro(session, datos["rubro_id"])
    if datos.get("fraccionable") is False and Decimal(producto.cantidad_abierta) != 0:
        raise APIError(
            400,
            "PRODUCTO_CON_ABIERTOS",
            "No se puede marcar como no fraccionable mientras tenga cantidad abierta; "
            "registrá antes un ajuste o una baja",
        )
    for campo in ("nombre", "rubro_id", "unidad", "contenido_envase", "fraccionable", "stock_minimo", "activo"):
        if campo in datos and datos[campo] is not None:
            setattr(producto, campo, datos[campo])
    # Campos que se pueden limpiar explícitamente con null.
    for campo in ("proveedor", "precio_costo", "precio_venta"):
        if campo in datos:
            setattr(producto, campo, datos[campo])
    session.add(producto)
    _commit(session)
    session.refresh(producto)
    return _item(session, producto)


def _commit(session: Session) -> None:
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if "UQ_Producto_Nombre" in str(exc.orig) or "producto.nombre" in str(exc.orig):
            raise APIError(409, "PRODUCTO_DUPLICADO", "Ya existe un producto con ese nombre") from exc
        raise


# ---------------------------------------------------------------------------
# Movimientos
# ---------------------------------------------------------------------------


def _plural(cantidad, singular: str, plural: str) -> str:
    return singular if Decimal(cantidad) == 1 else plural


def aplicar_movimiento(
    session: Session,
    producto: Producto,
    *,
    tipo: str,
    delta_cerrados: int,
    delta_abierta: Decimal,
    usuario_id: int,
    venta_id: int | None = None,
    fecha_vencimiento: date | None = None,
    observaciones: str | None = None,
    es_recuento: bool = False,
) -> tuple[MovimientoStock, list[str]]:
    """Crea el movimiento y actualiza los saldos del producto (sin commit).

    Nunca deja saldos negativos ni bloquea la operación: si la salida supera lo registrado,
    el movimiento se guarda con la cantidad real, el saldo queda en 0 y se agrega un
    movimiento `ajuste` automático por el faltante, de modo que el historial siga
    explicando el stock. El producto queda marcado `requiere_revision` hasta un recuento.
    """
    delta_abierta = _q(delta_abierta)
    movimiento = MovimientoStock(
        producto_id=producto.id or 0,
        tipo=tipo,
        delta_envases_cerrados=delta_cerrados,
        delta_cantidad_abierta=delta_abierta,
        usuario_id=usuario_id,
        venta_id=venta_id,
        fecha_vencimiento=fecha_vencimiento,
        observaciones=observaciones,
    )
    session.add(movimiento)

    nuevos_cerrados = producto.envases_cerrados + delta_cerrados
    nueva_abierta = _q(Decimal(producto.cantidad_abierta) + delta_abierta)
    faltan_cerrados = max(0, -nuevos_cerrados)
    falta_abierta = max(Decimal("0"), -nueva_abierta)

    advertencias: list[str] = []
    if faltan_cerrados or falta_abierta:
        partes = []
        if faltan_cerrados:
            partes.append(
                f"{faltan_cerrados} {_plural(faltan_cerrados, 'envase cerrado', 'envases cerrados')}"
            )
        if falta_abierta:
            partes.append(f"{_fmt(falta_abierta)} {producto.unidad} abiertos")
        faltante = " y ".join(partes)
        session.add(
            MovimientoStock(
                producto_id=producto.id or 0,
                tipo="ajuste",
                delta_envases_cerrados=faltan_cerrados,
                delta_cantidad_abierta=_q(falta_abierta),
                usuario_id=usuario_id,
                observaciones=(
                    f"Ajuste automático: el stock registrado no alcanzaba (faltaba {faltante}). "
                    "Revisar inventario."
                )[:255],
            )
        )
        producto.requiere_revision = True
        advertencias.append(
            f"Hay un error en el stock de {producto.nombre}: el registrado no alcanzaba "
            f"(faltaba {faltante}). Se dejó en 0 y quedó marcado para revisar el inventario."
        )
    elif es_recuento:
        producto.requiere_revision = False

    producto.envases_cerrados = max(nuevos_cerrados, 0)
    producto.cantidad_abierta = max(nueva_abierta, Decimal("0"))
    session.add(producto)
    session.flush()

    if (
        not faltan_cerrados
        and delta_cerrados < 0
        and producto.stock_minimo > 0
        and producto.envases_cerrados < producto.stock_minimo
    ):
        advertencias.append(
            f"{producto.nombre}: quedó por debajo del mínimo "
            f"({producto.envases_cerrados} de {producto.stock_minimo} envases cerrados)."
        )
    return movimiento, advertencias


def _es_entero(value: Decimal) -> bool:
    return Decimal(value) == Decimal(value).to_integral_value()


def _deltas_para(producto: Producto, payload) -> tuple[int, Decimal]:
    contenido = Decimal(producto.contenido_envase)
    if isinstance(payload, CompraIn):
        return payload.envases, Decimal("0")

    if isinstance(payload, ConsumoClinicoIn):
        if not producto.fraccionable:
            if not _es_entero(payload.cantidad):
                raise APIError(
                    400,
                    "CANTIDAD_INVALIDA",
                    "Este producto no es fraccionable: el consumo se carga en envases enteros",
                )
            if payload.envases_abiertos_nuevos:
                raise APIError(
                    400,
                    "CANTIDAD_INVALIDA",
                    "Este producto no es fraccionable: no se abren envases",
                )
            return -int(payload.cantidad), Decimal("0")
        abiertos = payload.envases_abiertos_nuevos
        return -abiertos, Decimal(abiertos) * contenido - payload.cantidad

    if isinstance(payload, VencimientoRoturaIn):
        if payload.cantidad_abierta > 0 and not producto.fraccionable:
            raise APIError(
                400, "CANTIDAD_INVALIDA", "Este producto no es fraccionable: no tiene cantidad abierta"
            )
        return -payload.envases, -payload.cantidad_abierta

    if isinstance(payload, AjusteIn):
        if payload.cantidad_abierta_real > 0 and not producto.fraccionable:
            raise APIError(
                400, "CANTIDAD_INVALIDA", "Este producto no es fraccionable: no tiene cantidad abierta"
            )
        delta_cerrados = payload.envases_cerrados_real - producto.envases_cerrados
        delta_abierta = _q(payload.cantidad_abierta_real) - _q(producto.cantidad_abierta)
        return delta_cerrados, delta_abierta

    raise APIError(400, "TIPO_INVALIDO", "Tipo de movimiento no soportado")


def registrar_movimiento(session: Session, payload, usuario_id: int) -> MovimientoResultado:
    producto = get_producto_model(session, payload.producto_id, bloquear=True)
    if not producto.activo and not isinstance(payload, AjusteIn):
        raise APIError(
            400, "PRODUCTO_INACTIVO", "El producto está dado de baja: solo admite ajustes"
        )
    delta_cerrados, delta_abierta = _deltas_para(producto, payload)
    es_recuento = isinstance(payload, AjusteIn)
    if es_recuento and delta_cerrados == 0 and delta_abierta == 0:
        if not producto.requiere_revision:
            raise APIError(
                400,
                "SIN_DIFERENCIAS",
                "El recuento coincide con el stock registrado: no hay nada que ajustar",
            )
        # El stock estaba bien: se confirma el recuento y se quita la marca, sin movimiento.
        producto.requiere_revision = False
        session.add(producto)
        session.commit()
        session.refresh(producto)
        return MovimientoResultado(
            movimiento=None,
            producto=_item(session, producto),
            advertencias=["Recuento confirmado: el stock coincide con lo registrado. Se quitó la marca de revisión."],
        )
    movimiento, advertencias = aplicar_movimiento(
        session,
        producto,
        tipo=payload.tipo,
        delta_cerrados=delta_cerrados,
        delta_abierta=delta_abierta,
        usuario_id=usuario_id,
        fecha_vencimiento=getattr(payload, "fecha_vencimiento", None),
        observaciones=payload.observaciones,
        es_recuento=es_recuento,
    )
    session.commit()
    session.refresh(producto)
    return MovimientoResultado(
        movimiento=get_movimiento(session, movimiento.id or 0),
        producto=_item(session, producto),
        advertencias=advertencias,
    )


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _movimientos_query():
    return (
        select(MovimientoStock, Producto.nombre, Producto.unidad, Usuario.username)
        .join(Producto, Producto.id == MovimientoStock.producto_id)
        .join(Usuario, Usuario.id == MovimientoStock.usuario_id)
    )


def _mov_item(row) -> MovimientoItem:
    mov, nombre, unidad, username = row
    return MovimientoItem(
        id=mov.id or 0,
        producto_id=mov.producto_id,
        producto_nombre=nombre,
        unidad=unidad,
        tipo=mov.tipo,
        destino=DESTINO_POR_TIPO.get(mov.tipo),
        delta_envases_cerrados=mov.delta_envases_cerrados,
        delta_cantidad_abierta=_q(mov.delta_cantidad_abierta),
        fecha=_as_utc(mov.fecha),
        usuario_id=mov.usuario_id,
        usuario_username=username,
        venta_id=mov.venta_id,
        fecha_vencimiento=mov.fecha_vencimiento,
        observaciones=mov.observaciones,
    )


def get_movimiento(session: Session, movimiento_id: int) -> MovimientoItem:
    row = session.exec(_movimientos_query().where(MovimientoStock.id == movimiento_id)).first()
    if row is None:
        raise APIError(404, "MOVIMIENTO_NO_ENCONTRADO", "No se encontró el movimiento")
    return _mov_item(row)


def list_movimientos(
    session: Session,
    *,
    producto_id: int | None = None,
    tipo: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> MovimientoListResponse:
    filtros = []
    if producto_id is not None:
        filtros.append(MovimientoStock.producto_id == producto_id)
    if tipo is not None:
        filtros.append(MovimientoStock.tipo == tipo)
    if desde is not None:
        filtros.append(MovimientoStock.fecha >= _as_utc(desde))
    if hasta is not None:
        filtros.append(MovimientoStock.fecha < _as_utc(hasta))
    page = max(page, 1)
    page_size = max(min(page_size, 200), 1)
    total = session.exec(select(func.count()).select_from(MovimientoStock).where(*filtros)).one()
    rows = session.exec(
        _movimientos_query()
        .where(*filtros)
        .order_by(col(MovimientoStock.fecha).desc(), col(MovimientoStock.id).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return MovimientoListResponse(
        items=[_mov_item(r) for r in rows], total=int(total), page=page, page_size=page_size
    )


# ---------------------------------------------------------------------------
# Análisis
# ---------------------------------------------------------------------------


def get_dias_alerta_vencimiento() -> int:
    raw = get_config_value(
        CONFIG_STOCK_ID, PARAM_DIAS_ALERTA_VENCIMIENTO, default=DEFAULT_DIAS_ALERTA_VENCIMIENTO
    )
    try:
        return max(int(raw), 0)
    except ValueError as exc:
        raise APIError(500, "CONFIG_INVALIDA", "DIAS_ALERTA_VENCIMIENTO debe ser un entero") from exc


def get_analisis(
    session: Session, *, desde: datetime | None = None, hasta: datetime | None = None
) -> AnalisisResponse:
    """Alertas actuales + uso por destino (pet shop vs consultorio) en el rango.

    Uso en envases equivalentes de cada salida = -(delta_cerrados + delta_abierta / contenido):
    una venta de 2 envases suma 2; un consumo de 2,5 ml de un frasco de 50 ml suma 0,05
    (aunque haya abierto un envase nuevo, porque lo que se abrió queda como abierto).
    """
    hasta_utc = _as_utc(hasta) if hasta else utc_now()
    desde_utc = _as_utc(desde) if desde else hasta_utc - timedelta(days=30)
    if desde_utc >= hasta_utc:
        raise APIError(400, "RANGO_INVALIDO", "'hasta' debe ser posterior a 'desde'")

    activos = session.exec(
        select(Producto, Rubro.nombre)
        .join(Rubro, Rubro.id == Producto.rubro_id)
        .where(Producto.activo.is_(True))
        .order_by(Producto.nombre)
    ).all()
    items = [_to_item(p, r) for p, r in activos]
    valor = sum(
        (
            Decimal(p.precio_costo) * equivalente_envases(p)
            for p, _ in activos
            if p.precio_costo is not None and equivalente_envases(p) > 0
        ),
        Decimal("0"),
    ).quantize(Decimal("0.01"))

    dias = get_dias_alerta_vencimiento()
    hoy = utc_now().date()
    vencimientos_rows = session.exec(
        select(MovimientoStock, Producto)
        .join(Producto, Producto.id == MovimientoStock.producto_id)
        .where(
            MovimientoStock.tipo == "compra",
            col(MovimientoStock.fecha_vencimiento).is_not(None),
            MovimientoStock.fecha_vencimiento <= hoy + timedelta(days=dias),
            MovimientoStock.fecha_vencimiento >= hoy - timedelta(days=DIAS_VENCIDOS_VISIBLES),
            Producto.activo.is_(True),
        )
        .order_by(MovimientoStock.fecha_vencimiento)
    ).all()
    vencimientos = [
        VencimientoItem(
            movimiento_id=mov.id or 0,
            producto_id=prod.id or 0,
            producto_nombre=prod.nombre,
            fecha_vencimiento=mov.fecha_vencimiento,
            envases_ingresados=mov.delta_envases_cerrados,
            vencido=mov.fecha_vencimiento < hoy,
        )
        for mov, prod in vencimientos_rows
        if equivalente_envases(prod) > 0
    ]

    salidas = session.exec(
        select(MovimientoStock, Producto, Rubro.nombre)
        .join(Producto, Producto.id == MovimientoStock.producto_id)
        .join(Rubro, Rubro.id == Producto.rubro_id)
        .where(
            col(MovimientoStock.tipo).in_(("venta", "consumo_clinico")),
            MovimientoStock.fecha >= desde_utc,
            MovimientoStock.fecha < hasta_utc,
        )
    ).all()
    por_producto: dict[int, dict] = {}
    por_rubro: dict[str, dict[str, Decimal]] = defaultdict(
        lambda: {"petshop": Decimal("0"), "consultorio": Decimal("0")}
    )
    for mov, prod, rubro_nombre in salidas:
        contenido = Decimal(prod.contenido_envase)
        envases = -(Decimal(mov.delta_envases_cerrados) + Decimal(mov.delta_cantidad_abierta) / contenido)
        destino = DESTINO_POR_TIPO[mov.tipo]
        datos = por_producto.setdefault(
            prod.id,
            {
                "prod": prod,
                "rubro": rubro_nombre,
                "petshop": Decimal("0"),
                "consultorio": Decimal("0"),
            },
        )
        datos[destino] += envases
        por_rubro[rubro_nombre][destino] += envases

    uso_producto = [
        UsoProductoItem(
            producto_id=d["prod"].id,
            producto_nombre=d["prod"].nombre,
            rubro_nombre=d["rubro"],
            unidad=d["prod"].unidad,
            petshop_envases=d["petshop"].quantize(ENVASES),
            consultorio_cantidad=_q(d["consultorio"] * Decimal(d["prod"].contenido_envase)),
            consultorio_envases=d["consultorio"].quantize(ENVASES),
        )
        for d in sorted(
            por_producto.values(), key=lambda d: d["petshop"] + d["consultorio"], reverse=True
        )
    ]
    uso_rubro = [
        UsoRubroItem(
            rubro_nombre=nombre,
            petshop_envases=v["petshop"].quantize(ENVASES),
            consultorio_envases=v["consultorio"].quantize(ENVASES),
        )
        for nombre, v in sorted(por_rubro.items())
    ]

    return AnalisisResponse(
        desde=desde_utc,
        hasta=hasta_utc,
        alertas=AlertasStock(
            revisar_stock=[i for i in items if "REVISAR_STOCK" in i.alertas],
            bajo_minimo=[i for i in items if "BAJO_MINIMO" in i.alertas],
            proximos_vencimientos=vencimientos,
            dias_alerta_vencimiento=dias,
        ),
        uso_por_producto=uso_producto,
        uso_por_rubro=uso_rubro,
        productos_activos=len(items),
        valor_inventario_costo=valor,
    )
