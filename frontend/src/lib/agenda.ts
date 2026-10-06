import { addDays, endOfDay, format, startOfDay, startOfWeek } from "date-fns";

import type {
  EstadoTurno,
  FranjaDisponible,
  HorarioAtencion,
  MotivoNoDisponible,
  TurnoItem,
} from "@/types/agenda";

export type VistaAgenda = "day" | "week" | "agenda";
export type AccionTurno = "confirmar" | "realizado" | "no_asistio" | "reprogramar" | "cancelar";

export const ESTADOS_MODIFICABLES: EstadoTurno[] = ["solicitado", "confirmado"];

export const ESTADO_LABEL: Record<EstadoTurno, string> = {
  solicitado: "Solicitado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
  no_asistio: "No asistió",
};

/** Clases de Tailwind por estado (paleta con nombre, sin hex). */
export const ESTADO_CLASES: Record<EstadoTurno, string> = {
  solicitado: "turno-solicitado",
  confirmado: "turno-confirmado",
  realizado: "turno-realizado",
  cancelado: "turno-cancelado",
  no_asistio: "turno-no-asistio",
};

export const ESTADO_BADGE: Record<EstadoTurno, string> = {
  solicitado: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  realizado: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  cancelado: "border-border bg-muted text-muted-foreground line-through",
  no_asistio: "border-destructive/40 bg-destructive/10 text-destructive",
};

export const CANAL_LABEL: Record<TurnoItem["canal_origen"], string> = {
  mostrador: "Mostrador",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  portal: "Portal",
};

export function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

/** Replica las transiciones del backend (Figura 5) para mostrar solo acciones válidas. */
export function accionesDisponibles(
  turno: Pick<TurnoItem, "estado" | "fecha_hora_inicio">,
  permisos: string[],
  ahora: Date = new Date(),
): AccionTurno[] {
  const acciones: AccionTurno[] = [];
  const puedeEditar = hasPermission(permisos, "agenda:editar_turno");
  const puedeCancelar = hasPermission(permisos, "agenda:cancelar_turno");
  const yaComenzo = new Date(turno.fecha_hora_inicio).getTime() <= ahora.getTime();

  if (puedeEditar && turno.estado === "solicitado") {
    acciones.push("confirmar");
  }
  if (puedeEditar && turno.estado === "confirmado" && yaComenzo) {
    acciones.push("realizado", "no_asistio");
  }
  if (puedeEditar && ESTADOS_MODIFICABLES.includes(turno.estado)) {
    acciones.push("reprogramar");
  }
  if (puedeCancelar && ESTADOS_MODIFICABLES.includes(turno.estado)) {
    acciones.push("cancelar");
  }
  return acciones;
}

export function puedeArrastrar(turno: Pick<TurnoItem, "estado">, permisos: string[]): boolean {
  return hasPermission(permisos, "agenda:editar_turno") && ESTADOS_MODIFICABLES.includes(turno.estado);
}

export interface EventoAgenda {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resourceId: number;
  turno: TurnoItem;
}

export function turnoToEvento(turno: TurnoItem): EventoAgenda {
  return {
    id: turno.id,
    title: `${turno.mascota_nombre} · ${turno.tipo_turno_nombre}`,
    start: new Date(turno.fecha_hora_inicio),
    end: new Date(turno.fecha_hora_fin),
    resourceId: turno.veterinario_id,
    turno,
  };
}

/** Rango [desde, hasta) a pedir al backend según la vista del calendario. */
export function rangoParaVista(vista: VistaAgenda, fecha: Date): { desde: Date; hasta: Date } {
  if (vista === "day") {
    return { desde: startOfDay(fecha), hasta: addDays(startOfDay(fecha), 1) };
  }
  if (vista === "week") {
    const lunes = startOfWeek(fecha, { weekStartsOn: 1 });
    return { desde: lunes, hasta: addDays(lunes, 7) };
  }
  // Vista lista: 30 días desde la fecha (mismo largo que la vista "agenda" de react-big-calendar).
  return { desde: startOfDay(fecha), hasta: endOfDay(addDays(fecha, 29)) };
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 0 = lunes ... 6 = domingo (igual que el backend). */
export function diaSemanaBackend(fecha: Date): number {
  return (fecha.getDay() + 6) % 7;
}

/** ¿El instante cae dentro de una franja de atención? (para sombrear horas cerradas). */
export function estaEnHorario(fecha: Date, horario: HorarioAtencion | null): boolean {
  if (!horario) {
    return true;
  }
  const dia = horario.dias.find((d) => d.dia_semana === diaSemanaBackend(fecha));
  if (!dia) {
    return false;
  }
  const actual = fecha.getHours() * 60 + fecha.getMinutes();
  return dia.franjas.some((f) => actual >= minutos(f.desde) && actual < minutos(f.hasta));
}

/** Primer y último horario de atención de la semana, para acotar el calendario. */
export function limitesHorario(horario: HorarioAtencion | null): { min: Date; max: Date } {
  let desde = 8 * 60;
  let hasta = 20 * 60;
  const franjas = horario?.dias.flatMap((d) => d.franjas) ?? [];
  if (franjas.length > 0) {
    desde = Math.min(...franjas.map((f) => minutos(f.desde)));
    hasta = Math.max(...franjas.map((f) => minutos(f.hasta)));
  }
  const base = new Date(1970, 0, 1);
  return {
    min: new Date(base.getFullYear(), 0, 1, Math.floor(desde / 60), desde % 60),
    max: new Date(base.getFullYear(), 0, 1, Math.floor(hasta / 60), hasta % 60),
  };
}

export function fechaIso(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

export function horaLabel(iso: string): string {
  return format(new Date(iso), "HH:mm");
}

export function franjaLabel(franja: FranjaDisponible): string {
  return `${horaLabel(franja.fecha_hora_inicio)} – ${horaLabel(franja.fecha_hora_fin)}`;
}

export const MOTIVO_LABEL: Record<MotivoNoDisponible, string> = {
  PASADO: "Pasado",
  EXCEDE_HORARIO: "No entra",
  OCUPADO_VETERINARIO: "Ocupado",
  OCUPADO_MASCOTA: "Mascota ocupada",
};

export function resumenFranjas(franjas: FranjaDisponible[]): { libres: number; noDisponibles: number } {
  const libres = franjas.filter((f) => f.disponible).length;
  return { libres, noDisponibles: franjas.length - libres };
}

/** Inicio a preseleccionar: mantiene el elegido si sigue libre; si no, el de la hora pedida (si está libre). */
export function inicioPreseleccionado(
  franjas: FranjaDisponible[],
  actual: string,
  hora?: string | null,
): string {
  const libres = franjas.filter((f) => f.disponible);
  if (libres.some((f) => f.fecha_hora_inicio === actual)) {
    return actual;
  }
  if (hora) {
    return libres.find((f) => horaLabel(f.fecha_hora_inicio) === hora)?.fecha_hora_inicio ?? "";
  }
  return "";
}

const MENSAJES_ERROR: Record<string, string> = {
  TURNO_SUPERPUESTO: "El veterinario ya tiene un turno en ese horario.",
  MASCOTA_CON_TURNO_SUPERPUESTO: "La mascota ya tiene un turno en ese horario.",
  TURNO_EN_EL_PASADO: "No se puede agendar un turno en el pasado.",
  TURNO_FUERA_DE_HORARIO: "El turno debe quedar completo dentro del horario de atención.",
  TURNO_FUERA_DE_MODULO: "El turno debe comenzar en un módulo exacto (ej. 08:00, 08:30).",
  DIA_SIN_ATENCION: "La clínica no atiende ese día.",
  VETERINARIO_INVALIDO: "El profesional elegido no está habilitado para atender turnos.",
  TRANSICION_INVALIDA: "El turno no admite ese cambio de estado.",
  TURNO_NO_INICIADO: "Solo se puede marcar realizado o no asistió un turno que ya comenzó.",
  TURNO_NO_REPROGRAMABLE: "Solo se pueden reprogramar turnos solicitados o confirmados.",
  PERMISOS_INSUFICIENTES: "No tenés permisos para realizar esta acción.",
};

/** Traduce un error de apiFetch (body.error = código del backend) a un mensaje para el usuario. */
export function mensajeError(error: unknown, fallback = "Ocurrió un error. Intentá de nuevo."): string {
  const body = (error as { body?: unknown })?.body;
  if (body && typeof body === "object" && "error" in body) {
    const codigo = (body as { error: unknown }).error;
    if (typeof codigo === "string" && MENSAJES_ERROR[codigo]) {
      return MENSAJES_ERROR[codigo];
    }
  }
  const mensaje = (error as Error)?.message;
  return mensaje || fallback;
}
