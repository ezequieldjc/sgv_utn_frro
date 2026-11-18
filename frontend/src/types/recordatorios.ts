import type { TipoPreventivo } from "@/types/vacunas";

// Contrato de /api/recordatorios (backend/app/schemas/recordatorios.py).
export interface ContactoTutor {
  persona_id: number;
  nombre: string;
  celular: string;
  /** Número para wa.me (549 + característica + número) o null si no se puede enviar. */
  whatsapp: string | null;
  motivo_sin_whatsapp: string | null;
}

export interface UltimoEnvio {
  fecha_envio: string;
  usuario_nombre: string;
  destino: string;
}

export interface RecordatorioTurno {
  turno_id: number;
  fecha_hora_inicio: string;
  estado_turno: string;
  tipo_turno: string;
  veterinario_nombre: string;
  mascota_id: number;
  mascota_nombre: string;
  tutor: ContactoTutor;
  mensaje: string;
  url_whatsapp: string | null;
  envios: number;
  ultimo_envio: UltimoEnvio | null;
}

export interface RecordatorioDosis {
  tratamiento_preventivo_id: number;
  tipo: TipoPreventivo;
  nombre_producto: string;
  fecha_aplicacion: string;
  fecha_proxima_dosis: string;
  /** Negativo: vencida hace tantos días. */
  dias_para_vencer: number;
  mascota_id: number;
  mascota_nombre: string;
  tutor: ContactoTutor;
  mensaje: string;
  url_whatsapp: string | null;
  envios: number;
  ultimo_envio: UltimoEnvio | null;
}

export interface RecordatoriosResponse {
  hoy: string;
  fecha_turnos: string;
  dias_aviso_dosis: number;
  dias_aviso_dosis_vencida: number;
  turnos: RecordatorioTurno[];
  dosis: RecordatorioDosis[];
}

export interface RecordatorioEnviado {
  id: number;
  tipo: "turno" | "dosis";
  fecha_envio: string;
  destino: string;
  mensaje: string;
  url_whatsapp: string;
  usuario_nombre: string;
}
