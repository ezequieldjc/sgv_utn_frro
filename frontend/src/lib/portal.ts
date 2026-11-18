import { edadLabel, SEXO_LABEL } from "@/lib/consultas";
import type { PortalMascota } from "@/types/portal";

export const PERMISO_PORTAL = "portal:ver";
export const PERMISO_PEDIR_TURNO = "portal:pedir_turno";
export const PERMISO_CREAR_MASCOTA = "portal:crear_mascota";

/** Lo que se muestra cuando algo se resuelve llamando a la clínica. */
export const COMUNICATE_CON_LA_CLINICA = "comunicate con la clínica";

/**
 * El inicio muestra el portal solo a quien tiene el permiso asignado explícitamente. Con el
 * comodín "*" (ADMIN) el menú igual muestra "Mi portal", pero el inicio sigue siendo el de la
 * clínica.
 */
export function tienePortalComoInicio(permisos: string[]): boolean {
  return permisos.includes(PERMISO_PORTAL);
}

const ESTADO_TURNO_LABEL: Record<string, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado",
  no_asistio: "No asistió",
};

export function estadoTurnoLabel(estado: string): string {
  return ESTADO_TURNO_LABEL[estado] ?? estado;
}

const MEDIO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
};

export function medioPagoLabel(medio: string): string {
  return MEDIO_PAGO_LABEL[medio] ?? medio;
}

const PESOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function montoLabel(valor: string | number): string {
  return PESOS.format(Number(valor));
}

export function fechaLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "jue 26/11, 09:00": para los turnos, donde importa el día de la semana. */
export function turnoLabel(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${dia}, ${hora}`;
}

/** El estado normal no se marca en la tarjeta. En el catálogo se llama "Activo" (id 1). */
export function esEstadoActivo(nombre: string): boolean {
  return /^activ[ao]$/i.test(nombre.trim());
}

export function pesoLabel(kg: string | number | null): string | null {
  if (kg === null || kg === undefined) {
    return null;
  }
  return `${Number(kg).toLocaleString("es-AR")} kg`;
}

export function temperaturaLabel(c: string | number | null): string | null {
  if (c === null || c === undefined) {
    return null;
  }
  return `${Number(c).toLocaleString("es-AR")} °C`;
}

/** "Canina · Bulldog Francés · Macho · 3 años", sin los datos que falten. */
export function resumenMascota(mascota: PortalMascota): string {
  return [
    mascota.especie_nombre,
    mascota.raza_nombre,
    mascota.sexo ? SEXO_LABEL[mascota.sexo] : null,
    edadLabel(mascota.edad_meses),
  ]
    .filter((parte): parte is string => Boolean(parte) && parte !== "Sin dato")
    .join(" · ");
}

/** Mensaje para el cliente: el portal responde 404 tanto a lo ajeno como a lo inexistente. */
export function mensajePortal(error: unknown, queCosa: string): string {
  const status = (error as { status?: number })?.status;
  if (status === 404) {
    return `No encontramos ${queCosa}.`;
  }
  if (status === 403) {
    return "Tu usuario no tiene acceso al portal de clientes.";
  }
  return "No pudimos cargar la información. Probá de nuevo en unos minutos.";
}

export function horaLabel(iso: string): string {
  // 24 horas, como la agenda: en es-AR el formato por defecto es "10:00 a. m.".
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export interface PedidoTurnoForm {
  mascota_id: string;
  tipo_turno_id: string;
  veterinario_id: string;
  fecha: string;
  fecha_hora_inicio: string;
}

/** Faltan datos para buscar horarios (todo menos el horario elegido). */
export function puedeBuscarHorarios(form: PedidoTurnoForm): boolean {
  return Boolean(form.mascota_id && form.tipo_turno_id && form.veterinario_id && form.fecha);
}

/** La fecha elegida es anterior al primer día permitido (mañana). Formato YYYY-MM-DD. */
export function fechaAntesDePermitida(fecha: string, primerDia: string): boolean {
  return Boolean(fecha) && fecha < primerDia;
}

// ---------------------------------------------------------------------------
// Alta de mascota (portal:crear_mascota)
// ---------------------------------------------------------------------------

export interface NuevaMascotaForm {
  nombre: string;
  especie_id: string;
  raza_id: string;
  sexo: "" | "M" | "H" | "U";
  fecha_nacimiento: string;
}

export type NuevaMascotaErrores = Partial<Record<keyof NuevaMascotaForm, string>>;

/** Hoy en formato yyyy-mm-dd (fecha local), para comparar con un input type="date". */
export function hoyIso(hoy: Date = new Date()): string {
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export function validarNuevaMascota(
  form: NuevaMascotaForm,
  hoy: string = hoyIso(),
): NuevaMascotaErrores {
  const errores: NuevaMascotaErrores = {};
  if (!form.nombre.trim()) {
    errores.nombre = "Poné el nombre de tu mascota.";
  }
  if (!form.especie_id) {
    errores.especie_id = "Elegí la especie.";
  }
  if (!form.raza_id) {
    errores.raza_id = "Elegí la raza.";
  }
  if (form.fecha_nacimiento && form.fecha_nacimiento > hoy) {
    errores.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
  }
  return errores;
}
