// Contrato de /api/recetas (backend/app/schemas/recetas.py). En el prototipo la receta sale de las
// indicaciones de la consulta firmada; el PDF se baja de /api/consultas/:id/receta.pdf.
export interface RecetaListItem {
  consulta_id: number;
  fecha_firma: string;
  mascota_id: number;
  mascota_nombre: string;
  tutor_nombre: string;
  veterinario_nombre: string;
  diagnostico_principal: string | null;
  indicaciones: string;
}

export interface RecetaListResponse {
  items: RecetaListItem[];
  total: number;
  page: number;
  page_size: number;
}
