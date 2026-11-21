import type { MedioPago } from "@/types/ventas";

// Contrato de /api/vacunas (backend/app/schemas/vacunas.py).
export type TipoPreventivo = "vacunacion" | "desparasitacion";
/** aplicar: hoy en la clínica, con stock. anterior: dosis que ya se dio (libreta, otra clínica). */
export type ModoRegistro = "aplicar" | "anterior";
export type EstadoDosis = "sin_refuerzo" | "reforzada" | "al_dia" | "por_vencer" | "vencida";

export interface TratamientoPreventivoItem {
  id: number;
  mascota_id: number;
  tipo: TipoPreventivo;
  producto_id: number | null;
  nombre_producto: string;
  aplicada_en_clinica: boolean;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string | null;
  estado_dosis: EstadoDosis;
  /** Días hasta la próxima dosis; negativo si ya venció. */
  dias_para_vencer: number | null;
  lote: string | null;
  peso_kg: string | null;
  refuerzo_de_id: number | null;
  reforzada_por_id: number | null;
  consulta_id: number | null;
  turno_id: number | null;
  venta_id: number | null;
  usuario_nombre: string;
  observaciones: string | null;
  fecha_registro: string;
}

export interface MascotaPreventivaResumen {
  id: number;
  nombre: string;
  especie_nombre: string;
  raza_nombre: string;
  tutor_id: number;
  tutor_nombre: string;
  ultimo_peso: string | null;
  estado_nombre: string;
  atendible: boolean;
}

export interface PreventivaConfig {
  dias_refuerzo_vacuna: number;
  dias_refuerzo_desparasitacion: number;
  dias_aviso_dosis: number;
  dias_aviso_dosis_vencida: number;
}

export interface VacunasMascotaResponse {
  hoy: string;
  mascota: MascotaPreventivaResumen;
  items: TratamientoPreventivoItem[];
  config: PreventivaConfig;
}

export interface ProductoPreventivoOpcion {
  id: number;
  nombre: string;
  tipo: TipoPreventivo;
  rubro_nombre: string;
  unidad: string;
  envases_cerrados: number;
  precio_venta: string | null;
}

export interface TratamientoPreventivoPayload {
  mascota_id: number;
  tipo: TipoPreventivo;
  modo: ModoRegistro;
  producto_id?: number | null;
  nombre_producto?: string | null;
  fecha_aplicacion?: string | null;
  fecha_proxima_dosis: string | null;
  lote?: string | null;
  peso_kg?: string | null;
  refuerzo_de_id?: number | null;
  cobrar?: boolean;
  medio_pago?: MedioPago | null;
  consulta_id?: number | null;
  turno_id?: number | null;
  observaciones?: string | null;
}

export interface TratamientoPreventivoResultado {
  item: TratamientoPreventivoItem;
  venta_id: number | null;
  venta_total: string | null;
  turno_atendido: boolean;
  advertencias: string[];
}
