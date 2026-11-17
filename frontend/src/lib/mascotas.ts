import type { CatalogoOpcion, TutorEventualConfig } from "@/types/mascotas";

/**
 * Regla del tutor eventual (ver backend/app/services/mascota_service.py):
 * - una mascota sin tutor registrado solo puede estar en los estados permitidos
 *   (por ejemplo, "En Tránsito / Rescate" o "Extraviado");
 * - al asignarle un dueño pasa a ACTIVA;
 * - si el parámetro no está cargado (`estados_permitidos` vacío), no hay restricción.
 */

/** Valor del filtro del listado que trae las mascotas que se pueden atender. */
export const FILTRO_ATENDIBLES = "atendibles";

function hayRegla(config: TutorEventualConfig | null): config is TutorEventualConfig {
  return config !== null && config.estados_permitidos.length > 0;
}

export function esTutorEventual(
  config: TutorEventualConfig | null,
  personaId: string | number | null,
): boolean {
  return (
    config !== null &&
    config.persona_id !== null &&
    personaId !== null &&
    personaId !== "" &&
    Number(personaId) === config.persona_id
  );
}

/** Estados que se pueden elegir para el tutor indicado. */
export function estadosParaTutor(
  estados: CatalogoOpcion[],
  config: TutorEventualConfig | null,
  personaId: string | number | null,
): CatalogoOpcion[] {
  if (hayRegla(config) && esTutorEventual(config, personaId)) {
    return config.estados_permitidos;
  }
  return estados;
}

/**
 * El estado que corresponde para ese tutor: si es el eventual y el estado actual no está
 * permitido (una mascota cargada antes de la regla), el de por defecto.
 */
export function estadoValidoParaTutor(
  config: TutorEventualConfig | null,
  estadoId: string,
  personaId: string | number | null,
): string {
  if (!hayRegla(config) || !esTutorEventual(config, personaId)) {
    return estadoId;
  }
  const permitido = config.estados_permitidos.some((e) => String(e.id) === estadoId);
  return permitido ? estadoId : String(config.estado_por_defecto_id ?? "");
}

/** Al pasar del tutor eventual a un dueño, la mascota queda ACTIVA. */
export function estadoTrasCambioDeTutor(
  config: TutorEventualConfig | null,
  estadoId: string,
  personaAnterior: string,
  personaNueva: string,
): string {
  if (
    config !== null &&
    esTutorEventual(config, personaAnterior) &&
    !esTutorEventual(config, personaNueva)
  ) {
    return String(config.estado_activa_id);
  }
  return estadoId;
}

/** "Activo, En Tránsito / Rescate o Extraviado": los estados que se pueden atender. */
export function etiquetaAtendibles(
  estados: CatalogoOpcion[],
  config: TutorEventualConfig | null,
): string {
  if (!hayRegla(config)) {
    return "Activas";
  }
  const activa = estados.find((e) => e.id === config.estado_activa_id)?.nombre ?? "Activa";
  const nombres = [activa, ...config.estados_permitidos.map((e) => e.nombre)];
  return `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}

/** "En Tránsito / Rescate o Extraviado", para los textos de ayuda. */
export function nombresPermitidos(config: TutorEventualConfig | null): string {
  if (!hayRegla(config)) {
    return "";
  }
  const nombres = config.estados_permitidos.map((e) => e.nombre);
  return nombres.length === 1
    ? nombres[0]
    : `${nombres.slice(0, -1).join(", ")} o ${nombres[nombres.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Especies: las más comunes arriba
// ---------------------------------------------------------------------------

/** Especies que se muestran primero al cargar una mascota: son casi todos los pacientes. */
export const ESPECIES_DESTACADAS = ["Canina", "Felina"];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/**
 * Separa las especies en las destacadas (en el orden de ESPECIES_DESTACADAS) y el resto
 * (en orden alfabético). Compara sin mayúsculas ni tildes.
 */
export function agruparEspecies<T extends { nombre: string }>(
  especies: T[],
): { destacadas: T[]; resto: T[] } {
  const orden = ESPECIES_DESTACADAS.map(normalizar);
  const destacadas = especies
    .filter((e) => orden.includes(normalizar(e.nombre)))
    .sort((a, b) => orden.indexOf(normalizar(a.nombre)) - orden.indexOf(normalizar(b.nombre)));
  const resto = especies
    .filter((e) => !orden.includes(normalizar(e.nombre)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return { destacadas, resto };
}
