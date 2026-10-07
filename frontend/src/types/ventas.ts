// TODO: reemplazar por tipo generado desde OpenAPI
export type MedioPago = "efectivo" | "debito" | "credito" | "transferencia";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VentaCreatePayload {
  items: { producto_id: number; cantidad: number }[];
  medio_pago: MedioPago;
  persona_id: number | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DetalleVentaItem {
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VentaDetail {
  id: number;
  fecha: string;
  total: string;
  medio_pago: MedioPago;
  persona_id: number | null;
  cliente_nombre: string | null;
  usuario_id: number;
  usuario_username: string;
  items: DetalleVentaItem[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VentaResultado {
  venta: VentaDetail;
  advertencias: string[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VentaListItem {
  id: number;
  fecha: string;
  total: string;
  medio_pago: MedioPago;
  cliente_nombre: string | null;
  usuario_username: string;
  cantidad_items: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VentaListResponse {
  items: VentaListItem[];
  total: number;
  page: number;
  page_size: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteOpcion {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
}
