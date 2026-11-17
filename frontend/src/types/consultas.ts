// TODO: reemplazar por tipos generados desde OpenAPI
// Espejo de backend/app/schemas/consultas.py

export type EstadoConsulta = "borrador" | "firmada";
export type TipoDiagnostico = "principal" | "secundario";
export type OrigenDiagnostico = "manual" | "sugerido_ia";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaResumen {
  id: number;
  nombre: string;
  especie_nombre: string;
  raza_nombre: string;
  raza_codigo: string | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  edad_meses: number | null;
  ultimo_peso: string | null;
  estado_reproductivo_nombre: string | null;
  alertas_medicas: string | null;
  tutor_nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ConsultaSignoItem {
  id: number;
  sintoma_id: number | null;
  codigo: string | null;
  nombre: string | null;
  sistema: string | null;
  texto_original: string;
  presente: boolean;
  origen: string;
  confirmado: boolean;
  dictado_id: number | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DiagnosticoItem {
  id: number;
  patologia_id: number | null;
  patologia_codigo: string | null;
  patologia_nombre: string | null;
  descripcion_libre: string | null;
  tipo_diagnostico: TipoDiagnostico;
  origen: OrigenDiagnostico;
  ranking: number | null;
  probabilidad_pct: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DictadoItem {
  id: number;
  transcripcion: string;
  modelo_stt: string;
  modelo_llm: string | null;
  version_prompt: string | null;
  fecha_creacion: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ConsultaDetalle {
  id: number;
  estado: EstadoConsulta;
  fecha_hora: string;
  fecha_firma: string | null;
  turno_id: number | null;
  veterinario_id: number;
  veterinario_nombre: string;
  motivo: string | null;
  anamnesis: string | null;
  examen_fisico: string | null;
  peso_kg: string | null;
  temperatura_c: string | null;
  tratamiento: string | null;
  observaciones: string | null;
  mascota: MascotaResumen;
  signos: ConsultaSignoItem[];
  diagnosticos: DiagnosticoItem[];
  dictados: DictadoItem[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ExplicacionSigno {
  codigo: string;
  frecuencia: number;
  sin_fila: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface Explicacion {
  prevalencia: number;
  raza: { codigo: string; multiplicador: number } | null;
  factores: unknown[];
  edad: unknown;
  sintomas_presentes: ExplicacionSigno[];
  sintomas_negados: ExplicacionSigno[];
  /** Desde simulado-0.2: peso de "otra causa no contemplada" en el mismo total. */
  otra_causa_pct?: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface SugerenciaItem {
  patologia_id: number;
  codigo: string;
  nombre: string;
  ranking: number;
  probabilidad_pct: string;
  estudio_sugerido: string | null;
  explicacion: Explicacion;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface SugerenciasResponse {
  version_motor: string;
  sugerencias: SugerenciaItem[];
  signos_sin_codigo: number;
  /** Peso de "otra causa no contemplada" en el mismo total que las sugerencias; null sin signos. */
  otra_causa_pct: string | null;
  /** Falso cuando "otra causa" es más probable que la primera sugerencia. */
  evidencia_suficiente: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ConsultaListItem {
  id: number;
  estado: EstadoConsulta;
  fecha_hora: string;
  fecha_firma: string | null;
  mascota_id: number;
  mascota_nombre: string;
  motivo: string | null;
  diagnostico_principal: string | null;
  veterinario_nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ConsultaListResponse {
  items: ConsultaListItem[];
  total: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface SintomaOpcion {
  id: number;
  codigo: string;
  nombre_es: string;
  sistema: string;
  tipo: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface PatologiaOpcion {
  id: number;
  codigo: string;
  nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ConsultaUpdatePayload {
  motivo?: string | null;
  anamnesis?: string | null;
  examen_fisico?: string | null;
  tratamiento?: string | null;
  observaciones?: string | null;
  peso_kg?: string | null;
  temperatura_c?: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DiagnosticoFirmaPayload {
  origen: OrigenDiagnostico;
  tipo_diagnostico: TipoDiagnostico;
  patologia_id: number | null;
  descripcion_libre: string | null;
}
