// TODO: reemplazar por tipo generado desde OpenAPI
export type Unidad = "unidad" | "ml" | "comprimido" | "g" | "kg";

// TODO: reemplazar por tipo generado desde OpenAPI
export type TipoMovimiento = "compra" | "venta" | "consumo_clinico" | "vencimiento_rotura" | "ajuste";

// TODO: reemplazar por tipo generado desde OpenAPI
export type AlertaProducto = "REVISAR_STOCK" | "BAJO_MINIMO";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface RubroOpcion {
  id: number;
  nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
// Los Decimal del backend viajan como string en el JSON.
export interface ProductoItem {
  id: number;
  nombre: string;
  rubro_id: number;
  rubro_nombre: string;
  proveedor: string | null;
  unidad: Unidad;
  contenido_envase: string;
  fraccionable: boolean;
  envases_cerrados: number;
  cantidad_abierta: string;
  stock_equivalente_envases: string;
  stock_minimo: number;
  precio_costo: string | null;
  precio_venta: string | null;
  se_vende: boolean;
  activo: boolean;
  requiere_revision: boolean;
  alertas: AlertaProducto[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ProductoListResponse {
  items: ProductoItem[];
  total: number;
  page: number;
  page_size: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ProductoCreatePayload {
  nombre: string;
  rubro_id: number;
  proveedor: string | null;
  unidad: Unidad;
  contenido_envase: string;
  fraccionable: boolean;
  stock_minimo: number;
  precio_costo: string | null;
  precio_venta: string | null;
  envases_iniciales: number;
  cantidad_abierta_inicial: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export type ProductoUpdatePayload = Partial<
  Omit<ProductoCreatePayload, "envases_iniciales" | "cantidad_abierta_inicial">
> & { activo?: boolean };

// TODO: reemplazar por tipo generado desde OpenAPI
export type MovimientoPayload =
  | { tipo: "compra"; producto_id: number; envases: number; fecha_vencimiento: string | null; observaciones: string | null }
  | { tipo: "consumo_clinico"; producto_id: number; cantidad: string; envases_abiertos_nuevos: number; observaciones: string | null }
  | { tipo: "vencimiento_rotura"; producto_id: number; envases: number; cantidad_abierta: string; observaciones: string | null }
  | { tipo: "ajuste"; producto_id: number; envases_cerrados_real: number; cantidad_abierta_real: string; observaciones: string | null };

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MovimientoItem {
  id: number;
  producto_id: number;
  producto_nombre: string;
  unidad: Unidad;
  tipo: TipoMovimiento;
  destino: "petshop" | "consultorio" | null;
  delta_envases_cerrados: number;
  delta_cantidad_abierta: string;
  fecha: string;
  usuario_id: number;
  usuario_username: string;
  venta_id: number | null;
  fecha_vencimiento: string | null;
  observaciones: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MovimientoResultado {
  movimiento: MovimientoItem | null;
  producto: ProductoItem;
  advertencias: string[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MovimientoListResponse {
  items: MovimientoItem[];
  total: number;
  page: number;
  page_size: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VencimientoItem {
  movimiento_id: number;
  producto_id: number;
  producto_nombre: string;
  fecha_vencimiento: string;
  envases_ingresados: number;
  vencido: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface UsoProductoItem {
  producto_id: number;
  producto_nombre: string;
  rubro_nombre: string;
  unidad: Unidad;
  petshop_envases: string;
  consultorio_cantidad: string;
  consultorio_envases: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface UsoRubroItem {
  rubro_nombre: string;
  petshop_envases: string;
  consultorio_envases: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface AnalisisResponse {
  desde: string;
  hasta: string;
  alertas: {
    revisar_stock: ProductoItem[];
    bajo_minimo: ProductoItem[];
    proximos_vencimientos: VencimientoItem[];
    dias_alerta_vencimiento: number;
  };
  uso_por_producto: UsoProductoItem[];
  uso_por_rubro: UsoRubroItem[];
  productos_activos: number;
  valor_inventario_costo: string;
}
