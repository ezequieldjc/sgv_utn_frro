import { sumarDias } from "@/lib/vacunas";
import type { UltimoEnvio } from "@/types/recordatorios";

export const PERMISO_RECORDATORIOS = "recordatorios:enviar";

/** Mañana (yyyy-MM-dd) a partir del "hoy" que manda el backend en la zona de la clínica. */
export function manana(hoy: string): string {
  return sumarDias(hoy, 1);
}

export function horaLabel(iso: string): string {
  // 24 horas, como la agenda: en es-AR el formato por defecto es "10:00 a. m.".
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** "+54 9 3406419004" a partir de 5493406419004 (solo para mostrar a qué número se manda). */
export function whatsappLabel(numero: string): string {
  return /^549\d{10}$/.test(numero) ? `+54 9 ${numero.slice(3)}` : numero;
}

export function envioLabel(ultimo: UltimoEnvio | null, envios: number): string | null {
  if (!ultimo) {
    return null;
  }
  const cuando = new Date(ultimo.fecha_envio).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const quien = ultimo.usuario_nombre ? ` por ${ultimo.usuario_nombre}` : "";
  const veces = envios > 1 ? ` (${envios} envíos)` : "";
  return `Enviado el ${cuando}${quien}${veces}`;
}
