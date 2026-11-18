import { addDays, format } from "date-fns";

import type {
  EstadoDosis,
  ModoRegistro,
  PreventivaConfig,
  TipoPreventivo,
  TratamientoPreventivoItem,
  TratamientoPreventivoPayload,
} from "@/types/vacunas";
import type { MedioPago } from "@/types/ventas";

/** Quién ve el carnet: los permisos de vacunas y el veterinario que atiende consultas. */
export const PERMISOS_VER_VACUNAS = [
  "vacunas:ver",
  "vacunas:registrar",
  "consultas:crear",
  "consultas:ver_historia_clinica",
];

export const TIPO_PREVENTIVO_LABEL: Record<TipoPreventivo, string> = {
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
};

export const ESTADO_DOSIS_CLASE: Record<EstadoDosis, string> = {
  al_dia: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  por_vencer: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  vencida: "bg-destructive/10 text-destructive",
  reforzada: "bg-muted text-muted-foreground",
  sin_refuerzo: "bg-muted text-muted-foreground",
};

// ---------------------------------------------------------------------------
// Fechas (siempre yyyy-MM-dd, sin pasar por la zona horaria del navegador)
// ---------------------------------------------------------------------------

function aFecha(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function sumarDias(fechaIso: string, dias: number): string {
  return format(addDays(aFecha(fechaIso), dias), "yyyy-MM-dd");
}

/** "2026-11-17" → "17/11/2026". */
export function fechaCorta(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Texto de cuánto falta para la próxima dosis (negativo: ya venció). */
export function diasLabel(dias: number): string {
  if (dias === 0) {
    return "vence hoy";
  }
  if (dias === 1) {
    return "vence mañana";
  }
  if (dias > 1) {
    return `vence en ${dias} días`;
  }
  if (dias === -1) {
    return "venció ayer";
  }
  return `venció hace ${-dias} días`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function estadoDosisTexto(
  item: Pick<TratamientoPreventivoItem, "estado_dosis" | "dias_para_vencer" | "fecha_proxima_dosis">,
): string {
  switch (item.estado_dosis) {
    case "sin_refuerzo":
      return "Sin refuerzo";
    case "reforzada":
      return "Refuerzo aplicado";
    case "al_dia":
      return item.fecha_proxima_dosis ? `Al día · próxima ${fechaCorta(item.fecha_proxima_dosis)}` : "Al día";
    default:
      return capitalizar(diasLabel(item.dias_para_vencer ?? 0));
  }
}

export function diasRefuerzo(tipo: TipoPreventivo, config: PreventivaConfig): number {
  return tipo === "vacunacion" ? config.dias_refuerzo_vacuna : config.dias_refuerzo_desparasitacion;
}

export function proximaDosisSugerida(
  fechaAplicacion: string,
  tipo: TipoPreventivo,
  config: PreventivaConfig,
): string {
  return sumarDias(fechaAplicacion, diasRefuerzo(tipo, config));
}

// ---------------------------------------------------------------------------
// Refuerzos
// ---------------------------------------------------------------------------

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Vacuna Séxtuple" y "séxtuple (libreta)" son la misma vacuna; "Antirrábica" y "Séxtuple", no. */
export function nombresCoinciden(a: string, b: string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x.length < 4 || y.length < 4) {
    return x === y;
  }
  return x === y || x.includes(y) || y.includes(x);
}

/** Dosis del mismo tipo que todavía esperan su refuerzo, la de vencimiento más cercano primero. */
export function dosisPendientes(
  items: TratamientoPreventivoItem[],
  tipo: TipoPreventivo,
): TratamientoPreventivoItem[] {
  return items
    .filter(
      (i) => i.tipo === tipo && i.fecha_proxima_dosis !== null && i.reforzada_por_id === null,
    )
    .sort((a, b) => (a.fecha_proxima_dosis ?? "").localeCompare(b.fecha_proxima_dosis ?? ""));
}

/**
 * Dosis que la aplicación nueva completa, si es evidente: una pendiente del mismo tipo, vencida o
 * por vencer, con el mismo producto. Si no hay una así, no se propone ninguna (mejor que vincular
 * mal una antirrábica con una séxtuple); el veterinario la puede elegir igual.
 */
export function refuerzoSugerido(
  items: TratamientoPreventivoItem[],
  tipo: TipoPreventivo,
  nombreProducto: string,
): number | null {
  if (!nombreProducto.trim()) {
    return null;
  }
  const candidata = dosisPendientes(items, tipo).find(
    (i) =>
      (i.estado_dosis === "por_vencer" || i.estado_dosis === "vencida") &&
      nombresCoinciden(i.nombre_producto, nombreProducto),
  );
  return candidata?.id ?? null;
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------

export interface VacunaForm {
  modo: ModoRegistro;
  tipo: TipoPreventivo;
  producto_id: string;
  nombre_producto: string;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string;
  sin_refuerzo: boolean;
  lote: string;
  peso_kg: string;
  refuerzo_de_id: string;
  cobrar: boolean;
  medio_pago: MedioPago;
  observaciones: string;
}

export type VacunaErrors = Partial<Record<keyof VacunaForm, string>>;

/**
 * Peso que se propone en el formulario. El último peso de la mascota es el de hoy: sirve para una
 * aplicación de ahora, no para una dosis anterior (la libreta de hace un año tenía otro peso).
 */
export function pesoPropuesto(modo: VacunaForm["modo"], ultimoPeso: string | null): string {
  return modo === "aplicar" && ultimoPeso ? String(Number(ultimoPeso)) : "";
}

export function formInicial(hoy: string, config: PreventivaConfig, peso: string | null): VacunaForm {
  return {
    modo: "aplicar",
    tipo: "vacunacion",
    producto_id: "",
    nombre_producto: "",
    fecha_aplicacion: hoy,
    fecha_proxima_dosis: proximaDosisSugerida(hoy, "vacunacion", config),
    sin_refuerzo: false,
    lote: "",
    peso_kg: pesoPropuesto("aplicar", peso),
    refuerzo_de_id: "",
    cobrar: true,
    medio_pago: "efectivo",
    observaciones: "",
  };
}

function numero(valor: string): number {
  return Number(valor.trim().replace(",", "."));
}

export function validarVacuna(form: VacunaForm, hoy: string): VacunaErrors {
  const errores: VacunaErrors = {};
  const fecha = form.modo === "aplicar" ? hoy : form.fecha_aplicacion;
  if (form.modo === "aplicar") {
    if (!form.producto_id) {
      errores.producto_id = "Elegí el producto del stock.";
    }
  } else {
    if (!form.nombre_producto.trim()) {
      errores.nombre_producto = "Indicá qué se aplicó.";
    }
    if (!form.fecha_aplicacion) {
      errores.fecha_aplicacion = "Indicá la fecha.";
    } else if (form.fecha_aplicacion > hoy) {
      errores.fecha_aplicacion = "No puede ser una fecha futura.";
    }
  }
  if (!form.sin_refuerzo) {
    if (!form.fecha_proxima_dosis) {
      errores.fecha_proxima_dosis = "Indicá la próxima dosis o marcá «Sin refuerzo».";
    } else if (fecha && form.fecha_proxima_dosis <= fecha) {
      errores.fecha_proxima_dosis = "Tiene que ser posterior a la aplicación.";
    }
  }
  if (form.peso_kg.trim()) {
    const peso = numero(form.peso_kg);
    if (!Number.isFinite(peso) || peso <= 0 || peso > 150) {
      errores.peso_kg = "Peso entre 0 y 150 kg.";
    }
  }
  if (form.lote.length > 50) {
    errores.lote = "Hasta 50 caracteres.";
  }
  if (form.observaciones.length > 255) {
    errores.observaciones = "Hasta 255 caracteres.";
  }
  return errores;
}

export function armarPayloadVacuna(
  form: VacunaForm,
  contexto: { mascotaId: number; turnoId: number | null; consultaId: number | null },
): TratamientoPreventivoPayload {
  const aplicar = form.modo === "aplicar";
  const texto = (valor: string) => valor.trim() || null;
  return {
    mascota_id: contexto.mascotaId,
    tipo: form.tipo,
    modo: form.modo,
    producto_id: aplicar ? Number(form.producto_id) : null,
    nombre_producto: aplicar ? null : form.nombre_producto.trim(),
    fecha_aplicacion: aplicar ? null : form.fecha_aplicacion,
    fecha_proxima_dosis: form.sin_refuerzo ? null : form.fecha_proxima_dosis || null,
    lote: texto(form.lote),
    peso_kg: form.peso_kg.trim() ? String(numero(form.peso_kg)) : null,
    refuerzo_de_id: form.refuerzo_de_id ? Number(form.refuerzo_de_id) : null,
    cobrar: aplicar && form.cobrar,
    medio_pago: aplicar && form.cobrar ? form.medio_pago : null,
    consulta_id: contexto.consultaId,
    turno_id: aplicar ? contexto.turnoId : null,
    observaciones: texto(form.observaciones),
  };
}

/** Mensaje de un 422 de Pydantic ("Value error, ...") o el detalle del backend. */
export function mensajeErrorApi(error: unknown, fallback: string): string {
  const body = (error as { body?: unknown })?.body;
  if (body && typeof body === "object" && "detail" in body) {
    const detalle = (body as { detail: unknown }).detail;
    if (Array.isArray(detalle) && detalle.length > 0) {
      const msg = (detalle[0] as { msg?: unknown }).msg;
      if (typeof msg === "string") {
        return msg.replace(/^Value error,\s*/, "");
      }
    }
  }
  const mensaje = (error as Error)?.message;
  return mensaje || fallback;
}

/** El tipo de turno "Vacunación" (sin importar mayúsculas ni tildes) se atiende registrando la dosis. */
export function esTurnoDeVacunacion(tipoTurno: string): boolean {
  return normalizar(tipoTurno).startsWith("vacun");
}
