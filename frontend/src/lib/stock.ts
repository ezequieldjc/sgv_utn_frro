import type {
  AlertaProducto,
  MovimientoPayload,
  ProductoItem,
  TipoMovimiento,
  Unidad,
} from "@/types/stock";
import type { MedioPago, VentaCreatePayload } from "@/types/ventas";

export const PERMISOS_STOCK = [
  "stock:crear_insumo",
  "stock:editar_insumo",
  "stock:registrar_movimiento",
  "stock:ver_movimientos",
  "stock:ver_analisis",
];

export function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

export function hasAnyPermission(permisos: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(permisos, p));
}

export const UNIDADES: Unidad[] = ["unidad", "ml", "comprimido", "g", "kg"];

export const UNIDAD_LABEL: Record<Unidad, string> = {
  unidad: "unidades",
  ml: "ml",
  comprimido: "comprimidos",
  g: "g",
  kg: "kg",
};

export const TIPO_LABEL: Record<TipoMovimiento, string> = {
  compra: "Compra",
  venta: "Venta",
  consumo_clinico: "Consumo clínico",
  vencimiento_rotura: "Vencimiento / rotura",
  ajuste: "Ajuste",
};

export const ALERTA_LABEL: Record<AlertaProducto, string> = {
  REVISAR_STOCK: "Revisar stock",
  BAJO_MINIMO: "Bajo mínimo",
};

export const ALERTA_CLASE: Record<AlertaProducto, string> = {
  REVISAR_STOCK:
    "border-destructive/40 bg-destructive/10 text-destructive dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-300",
  BAJO_MINIMO: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export const MEDIO_PAGO_LABEL: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
};

/** Parsea números que llegan como string (Decimal) o que escribe el usuario con coma. */
export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return value;
  }
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** "1234.5" -> "1.234,5" (hasta 3 decimales, sin ceros de más). */
export function fmtCantidad(value: string | number): string {
  return num(value).toLocaleString("es-AR", { maximumFractionDigits: 3 });
}

export function fmtMoneda(value: string | number | null): string {
  if (value === null) {
    return "—";
  }
  return num(value).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

/** Texto del stock: "8 cerrados + 130 ml abiertos" (fraccionable) o "8 envases". */
export function formatoStock(
  p: Pick<ProductoItem, "fraccionable" | "envases_cerrados" | "cantidad_abierta" | "unidad">,
): string {
  if (!p.fraccionable) {
    return `${p.envases_cerrados} ${p.envases_cerrados === 1 ? "envase" : "envases"}`;
  }
  return `${p.envases_cerrados} cerrados + ${fmtCantidad(p.cantidad_abierta)} ${UNIDAD_LABEL[p.unidad]} abiertos`;
}

export function equivalenteEnvases(
  p: Pick<ProductoItem, "envases_cerrados" | "cantidad_abierta" | "contenido_envase">,
): number {
  const contenido = num(p.contenido_envase) || 1;
  return p.envases_cerrados + num(p.cantidad_abierta) / contenido;
}

// ---------------------------------------------------------------------------
// Movimientos: formulario, validación, payload y vista previa
// ---------------------------------------------------------------------------

export type TipoMovimientoManual = Exclude<TipoMovimiento, "venta">;

export const TIPOS_MANUALES: TipoMovimientoManual[] = [
  "compra",
  "consumo_clinico",
  "vencimiento_rotura",
  "ajuste",
];

export interface MovimientoForm {
  tipo: TipoMovimientoManual;
  envases: string;
  fecha_vencimiento: string;
  cantidad: string;
  /** "abierto" = de un envase ya abierto; "nuevos" = se abrieron N envases. */
  origen_consumo: "abierto" | "nuevos";
  envases_abiertos_nuevos: string;
  cantidad_abierta: string;
  envases_cerrados_real: string;
  cantidad_abierta_real: string;
  observaciones: string;
}

export type MovimientoErrors = Partial<Record<keyof MovimientoForm, string>>;

export const INITIAL_MOVIMIENTO: MovimientoForm = {
  tipo: "compra",
  envases: "",
  fecha_vencimiento: "",
  cantidad: "",
  origen_consumo: "abierto",
  envases_abiertos_nuevos: "1",
  cantidad_abierta: "",
  envases_cerrados_real: "",
  cantidad_abierta_real: "",
  observaciones: "",
};

function esEnteroPositivo(value: string, permitirCero = false): boolean {
  const n = num(value);
  return Number.isInteger(n) && (permitirCero ? n >= 0 : n > 0);
}

function esCantidad(value: string, permitirCero = false): boolean {
  const n = num(value);
  return Number.isFinite(n) && (permitirCero ? n >= 0 : n > 0);
}

export function validateMovimiento(
  form: MovimientoForm,
  producto: Pick<ProductoItem, "fraccionable"> | null,
): MovimientoErrors {
  const errors: MovimientoErrors = {};
  if (!producto) {
    return errors;
  }
  if (form.tipo === "compra" && !esEnteroPositivo(form.envases)) {
    errors.envases = "Ingresá una cantidad entera de envases mayor a 0.";
  }
  if (form.tipo === "consumo_clinico") {
    if (producto.fraccionable) {
      if (!esCantidad(form.cantidad)) {
        errors.cantidad = "Ingresá la cantidad usada (mayor a 0).";
      }
      if (form.origen_consumo === "nuevos" && !esEnteroPositivo(form.envases_abiertos_nuevos)) {
        errors.envases_abiertos_nuevos = "Indicá cuántos envases se abrieron (1 o más).";
      }
    } else if (!esEnteroPositivo(form.cantidad)) {
      errors.cantidad = "Este producto se consume en envases enteros.";
    }
  }
  if (form.tipo === "vencimiento_rotura") {
    const envasesOk = form.envases.trim() === "" || esEnteroPositivo(form.envases, true);
    const abiertaOk = form.cantidad_abierta.trim() === "" || esCantidad(form.cantidad_abierta, true);
    if (!envasesOk) {
      errors.envases = "Ingresá una cantidad entera de envases.";
    }
    if (!abiertaOk) {
      errors.cantidad_abierta = "Ingresá una cantidad válida.";
    }
    if (envasesOk && abiertaOk && num(form.envases) === 0 && num(form.cantidad_abierta) === 0) {
      errors.envases = "Indicá envases cerrados y/o cantidad abierta a dar de baja.";
    }
  }
  if (form.tipo === "ajuste") {
    if (!esEnteroPositivo(form.envases_cerrados_real, true)) {
      errors.envases_cerrados_real = "Ingresá los envases cerrados contados (0 o más).";
    }
    if (producto.fraccionable && form.cantidad_abierta_real.trim() !== "" && !esCantidad(form.cantidad_abierta_real, true)) {
      errors.cantidad_abierta_real = "Ingresá la cantidad abierta contada.";
    }
  }
  return errors;
}

function texto(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function decimal(value: string): string {
  return String(num(value) || 0);
}

export function buildMovimientoPayload(
  form: MovimientoForm,
  productoId: number,
  fraccionable: boolean,
): MovimientoPayload {
  const observaciones = texto(form.observaciones);
  switch (form.tipo) {
    case "compra":
      return {
        tipo: "compra",
        producto_id: productoId,
        envases: num(form.envases),
        fecha_vencimiento: form.fecha_vencimiento || null,
        observaciones,
      };
    case "consumo_clinico":
      return {
        tipo: "consumo_clinico",
        producto_id: productoId,
        cantidad: decimal(form.cantidad),
        envases_abiertos_nuevos:
          fraccionable && form.origen_consumo === "nuevos" ? num(form.envases_abiertos_nuevos) : 0,
        observaciones,
      };
    case "vencimiento_rotura":
      return {
        tipo: "vencimiento_rotura",
        producto_id: productoId,
        envases: num(form.envases),
        cantidad_abierta: fraccionable ? decimal(form.cantidad_abierta) : "0",
        observaciones,
      };
    case "ajuste":
      return {
        tipo: "ajuste",
        producto_id: productoId,
        envases_cerrados_real: num(form.envases_cerrados_real),
        cantidad_abierta_real: fraccionable ? decimal(form.cantidad_abierta_real) : "0",
        observaciones,
      };
  }
}

export interface PreviewMovimiento {
  cerrados: number;
  abierta: number;
  /** La salida supera lo registrado: el backend dejará 0 y marcará "Revisar stock". */
  faltante: boolean;
}

/** Replica la regla del backend para mostrar cómo quedaría el stock antes de confirmar. */
export function previewMovimiento(
  producto: Pick<ProductoItem, "envases_cerrados" | "cantidad_abierta" | "contenido_envase" | "fraccionable">,
  form: MovimientoForm,
): PreviewMovimiento {
  const cerrados = producto.envases_cerrados;
  const abierta = num(producto.cantidad_abierta);
  const contenido = num(producto.contenido_envase);
  let dc = 0;
  let da = 0;
  if (form.tipo === "compra") {
    dc = num(form.envases) || 0;
  } else if (form.tipo === "consumo_clinico") {
    if (producto.fraccionable) {
      const nuevos = form.origen_consumo === "nuevos" ? num(form.envases_abiertos_nuevos) || 0 : 0;
      dc = -nuevos;
      da = nuevos * contenido - (num(form.cantidad) || 0);
    } else {
      dc = -(num(form.cantidad) || 0);
    }
  } else if (form.tipo === "vencimiento_rotura") {
    dc = -(num(form.envases) || 0);
    da = -(num(form.cantidad_abierta) || 0);
  } else {
    dc = (num(form.envases_cerrados_real) || 0) - cerrados;
    da = (num(form.cantidad_abierta_real) || 0) - abierta;
  }
  const nuevosCerrados = cerrados + dc;
  const nuevaAbierta = Math.round((abierta + da) * 1000) / 1000;
  return {
    cerrados: Math.max(nuevosCerrados, 0),
    abierta: Math.max(nuevaAbierta, 0),
    faltante: nuevosCerrados < 0 || nuevaAbierta < 0,
  };
}

// ---------------------------------------------------------------------------
// Ventas: carrito
// ---------------------------------------------------------------------------

export interface LineaCarrito {
  producto: Pick<ProductoItem, "id" | "nombre" | "precio_venta" | "envases_cerrados">;
  cantidad: number;
}

export function subtotalLinea(linea: LineaCarrito): number {
  return num(linea.producto.precio_venta) * linea.cantidad;
}

export function totalCarrito(lineas: LineaCarrito[]): number {
  return Math.round(lineas.reduce((acc, l) => acc + subtotalLinea(l), 0) * 100) / 100;
}

/** Aviso previo (no bloquea): la cantidad supera los envases cerrados registrados. */
export function avisoStockLinea(linea: LineaCarrito): string | null {
  if (linea.cantidad > linea.producto.envases_cerrados) {
    return `El stock registrado es ${linea.producto.envases_cerrados}. Se puede vender igual; el producto quedará marcado para revisar.`;
  }
  return null;
}

export function agregarAlCarrito(
  lineas: LineaCarrito[],
  producto: LineaCarrito["producto"],
): LineaCarrito[] {
  const existente = lineas.find((l) => l.producto.id === producto.id);
  if (existente) {
    return lineas.map((l) => (l.producto.id === producto.id ? { ...l, cantidad: l.cantidad + 1 } : l));
  }
  return [...lineas, { producto, cantidad: 1 }];
}

export function cambiarCantidad(lineas: LineaCarrito[], productoId: number, cantidad: number): LineaCarrito[] {
  if (cantidad <= 0) {
    return lineas.filter((l) => l.producto.id !== productoId);
  }
  return lineas.map((l) => (l.producto.id === productoId ? { ...l, cantidad } : l));
}

export function buildVentaPayload(
  lineas: LineaCarrito[],
  medioPago: MedioPago,
  personaId: number | null,
): VentaCreatePayload {
  return {
    items: lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
    medio_pago: medioPago,
    persona_id: personaId,
  };
}
