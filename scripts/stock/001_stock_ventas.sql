-- =============================================================================
-- 001_stock_ventas.sql — Módulo Stock (inventario unificado) y Ventas de mostrador
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
-- fastapi_app solo recibe DML (ver sección 6).
--
-- Historial:
--   - dev-agenda (Neon): aplicado completo el 06/10/2026, y luego el ALTER de
--     requiere_revision + CHECK de no negativos (ver nota al pie). Ya está todo aplicado.
--   - main: correr completo al mergear feature/stock (después de 001_agenda_turno.sql);
--     esta versión ya incluye esos cambios en el CREATE TABLE.
--
-- Modelo de stock por producto:
--   envases_cerrados (entero) = lo único que se vende en pet shop.
--   cantidad_abierta (en "unidad") = remanente de envases abiertos (uso clínico fraccionado).
--   Cada movimiento guarda el delta de ambos saldos; el historial explica el stock.
--   Los saldos nunca son negativos: si una salida supera lo registrado, el backend deja el
--   saldo en 0, agrega un ajuste automático por el faltante y marca requiere_revision.
--   El destino sale del tipo: venta = pet shop, consumo_clinico = consultorio.
-- =============================================================================

BEGIN;

-- 1. Rubro (catálogo global)
CREATE TABLE catalogo.rubro (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(50)  NOT NULL,
    descripcion  VARCHAR(255),
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "UQ_Rubro_Nombre" UNIQUE (nombre)
);

CREATE SCHEMA IF NOT EXISTS stock;
CREATE SCHEMA IF NOT EXISTS comercial;

-- 2. Producto (inventario único para consultorio y pet shop)
CREATE TABLE stock.producto (
    id                 SERIAL PRIMARY KEY,
    nombre             VARCHAR(100)  NOT NULL,           -- incluye presentación: "Ivermectina 1% 50 ml"
    rubro_id           INTEGER       NOT NULL REFERENCES catalogo.rubro(id),
    proveedor          VARCHAR(100),
    unidad             VARCHAR(20)   NOT NULL,           -- unidad en la que se mide lo abierto
    contenido_envase   NUMERIC(10,3) NOT NULL DEFAULT 1, -- ej. 50 (ml por frasco)
    fraccionable       BOOLEAN       NOT NULL DEFAULT FALSE,
    envases_cerrados   INTEGER       NOT NULL DEFAULT 0,
    cantidad_abierta   NUMERIC(12,3) NOT NULL DEFAULT 0, -- en "unidad"
    stock_minimo       INTEGER       NOT NULL DEFAULT 0, -- en envases cerrados
    precio_costo       NUMERIC(12,2),
    precio_venta       NUMERIC(12,2),                    -- NULL = no se vende en pet shop
    activo             BOOLEAN       NOT NULL DEFAULT TRUE,
    requiere_revision  BOOLEAN       NOT NULL DEFAULT FALSE, -- hubo faltante; se limpia con un recuento
    CONSTRAINT "UQ_Producto_Nombre"      UNIQUE (nombre),
    CONSTRAINT "CK_Producto_Unidad"      CHECK (unidad IN ('unidad','ml','comprimido','g','kg')),
    CONSTRAINT "CK_Producto_Contenido"   CHECK (contenido_envase > 0),
    CONSTRAINT "CK_Producto_Minimo"      CHECK (stock_minimo >= 0),
    CONSTRAINT "CK_Producto_Precios"     CHECK (COALESCE(precio_costo,0) >= 0 AND COALESCE(precio_venta,0) >= 0),
    CONSTRAINT "CK_Producto_Fraccion"    CHECK (fraccionable OR cantidad_abierta = 0),
    CONSTRAINT "CK_Producto_CerradosNoNegativo" CHECK (envases_cerrados >= 0),
    CONSTRAINT "CK_Producto_AbiertaNoNegativa"  CHECK (cantidad_abierta >= 0)
);

-- 3. Venta de mostrador
CREATE TABLE comercial.venta (
    id          SERIAL PRIMARY KEY,
    persona_id  INTEGER       REFERENCES core.persona(id),           -- cliente opcional
    usuario_id  INTEGER       NOT NULL REFERENCES auth.usuario(id),  -- quién vendió
    fecha       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    total       NUMERIC(12,2) NOT NULL,
    medio_pago  VARCHAR(20)   NOT NULL,
    CONSTRAINT "CK_Venta_MedioPago" CHECK (medio_pago IN ('efectivo','debito','credito','transferencia')),
    CONSTRAINT "CK_Venta_Total"     CHECK (total >= 0)
);

CREATE TABLE comercial.detalle_venta (
    id               SERIAL PRIMARY KEY,
    venta_id         INTEGER       NOT NULL REFERENCES comercial.venta(id),
    producto_id      INTEGER       NOT NULL REFERENCES stock.producto(id),
    cantidad         INTEGER       NOT NULL,   -- envases completos
    precio_unitario  NUMERIC(12,2) NOT NULL,   -- precio al momento de la venta
    CONSTRAINT "UQ_DetalleVenta_Producto" UNIQUE (venta_id, producto_id),
    CONSTRAINT "CK_DetalleVenta_Cantidad" CHECK (cantidad > 0)
);

-- 4. Movimientos (historial = fuente de la verdad del stock)
--    consulta_id se agregará con ALTER cuando exista la tabla Consulta (US-09).
CREATE TABLE stock.movimiento_stock (
    id                      SERIAL PRIMARY KEY,
    producto_id             INTEGER       NOT NULL REFERENCES stock.producto(id),
    tipo                    VARCHAR(30)   NOT NULL,
    delta_envases_cerrados  INTEGER       NOT NULL DEFAULT 0,
    delta_cantidad_abierta  NUMERIC(12,3) NOT NULL DEFAULT 0,
    fecha                   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    usuario_id              INTEGER       NOT NULL REFERENCES auth.usuario(id),
    venta_id                INTEGER       REFERENCES comercial.venta(id),
    fecha_vencimiento       DATE,          -- opcional, en compras
    observaciones           VARCHAR(255),
    CONSTRAINT "CK_Movimiento_Tipo"  CHECK (tipo IN ('compra','venta','consumo_clinico','vencimiento_rotura','ajuste')),
    CONSTRAINT "CK_Movimiento_Delta" CHECK (delta_envases_cerrados <> 0 OR delta_cantidad_abierta <> 0),
    CONSTRAINT "CK_Movimiento_Venta" CHECK ((tipo = 'venta') = (venta_id IS NOT NULL))
);

CREATE INDEX "IX_Movimiento_Producto_Fecha" ON stock.movimiento_stock (producto_id, fecha);
CREATE INDEX "IX_Movimiento_Tipo_Fecha"     ON stock.movimiento_stock (tipo, fecha);
CREATE INDEX "IX_Venta_Fecha"               ON comercial.venta (fecha);

-- 5. Datos iniciales
INSERT INTO catalogo.rubro (nombre) VALUES
('Alimento'), ('Medicamento'), ('Antiparasitario'), ('Vacuna'),
('Descartable'), ('Higiene'), ('Accesorio')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO auth.permiso (nombre, descripcion) VALUES
('ventas:registrar', 'Permite registrar ventas de mostrador'),
('ventas:ver',       'Permite consultar el historial de ventas')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor) VALUES
(5, 'STOCK', 1, 'DIAS_ALERTA_VENCIMIENTO', '30')
ON CONFLICT (config_id, parametro_id) DO NOTHING;

-- 6. Grants DML para fastapi_app
GRANT SELECT, INSERT, UPDATE, DELETE ON catalogo.rubro TO fastapi_app;
GRANT USAGE, SELECT ON SEQUENCE catalogo.rubro_id_seq TO fastapi_app;
GRANT USAGE ON SCHEMA stock, comercial TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA stock, comercial TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA stock, comercial TO fastapi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA stock, comercial GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA stock, comercial GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

COMMIT;

-- Nota: en dev-agenda estos cambios se aplicaron después con:
--   ALTER TABLE stock.producto
--       ADD COLUMN requiere_revision BOOLEAN NOT NULL DEFAULT FALSE,
--       ADD CONSTRAINT "CK_Producto_CerradosNoNegativo" CHECK (envases_cerrados >= 0),
--       ADD CONSTRAINT "CK_Producto_AbiertaNoNegativa"  CHECK (cantidad_abierta >= 0);

-- Verificación:
-- SELECT has_schema_privilege('fastapi_app', 'stock', 'USAGE'), has_schema_privilege('fastapi_app', 'comercial', 'USAGE');
-- SELECT * FROM catalogo.rubro;
-- SELECT * FROM sys.config WHERE config_id = 5;
