/** Quién ve el historial de recetas y baja los PDF (mismos permisos que el backend). */
export const PERMISOS_RECETAS = [
  "recetas:ver_historial",
  "recetas:crear",
  "consultas:ver_historial",
  "consultas:ver_historia_clinica",
];

/** La receta existe cuando la consulta está firmada y tiene indicaciones de tratamiento. */
export function tieneReceta(consulta: { estado: string; tratamiento: string | null }): boolean {
  return consulta.estado === "firmada" && Boolean(consulta.tratamiento?.trim());
}
