// TODO: reemplazar por tipo generado desde OpenAPI
export type EstadoTurno = "solicitado" | "confirmado" | "realizado" | "cancelado" | "no_asistio";

// TODO: reemplazar por tipo generado desde OpenAPI
export type CanalOrigen = "mostrador" | "telefono" | "whatsapp" | "portal";

// TODO: reemplazar por tipo generado desde OpenAPI
export type CanalOrigenInterno = "mostrador" | "telefono" | "whatsapp";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TurnoItem {
  id: number;
  mascota_id: number;
  mascota_nombre: string;
  tutor_id: number;
  tutor_nombre: string;
  tutor_apellido: string;
  tutor_celular: string | null;
  veterinario_id: number;
  veterinario_nombre: string;
  veterinario_apellido: string;
  tipo_turno_id: number;
  tipo_turno_nombre: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  estado: EstadoTurno;
  canal_origen: CanalOrigen;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TurnoListResponse {
  items: TurnoItem[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TurnoCreatePayload {
  mascota_id: number;
  veterinario_id: number;
  tipo_turno_id: number;
  fecha_hora_inicio: string;
  canal_origen: CanalOrigenInterno;
  estado_inicial: "solicitado" | "confirmado";
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TurnoReprogramarPayload {
  fecha_hora_inicio?: string;
  veterinario_id?: number;
  tipo_turno_id?: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TurnoCambioEstadoPayload {
  estado: "confirmado" | "realizado" | "no_asistio";
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface VeterinarioOpcion {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TipoTurnoOpcion {
  id: number;
  nombre: string;
  duracion_min: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaAgendaOpcion {
  id: number;
  nombre: string;
  especie_nombre: string;
  raza_nombre: string;
  tutor_id: number;
  tutor_nombre: string;
  tutor_apellido: string;
  tutor_dni: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface FranjaHoraria {
  desde: string;
  hasta: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface HorarioDia {
  dia_semana: number; // 0 = lunes ... 6 = domingo
  franjas: FranjaHoraria[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface HorarioAtencion {
  zona_horaria: string;
  duracion_modulo_min: number;
  dias: HorarioDia[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export type MotivoNoDisponible =
  | "PASADO"
  | "EXCEDE_HORARIO"
  | "OCUPADO_VETERINARIO"
  | "OCUPADO_MASCOTA";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface FranjaDisponible {
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  disponible: boolean;
  motivo: MotivoNoDisponible | null;
  detalle: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DisponibilidadResponse {
  fecha: string;
  veterinario_id: number;
  tipo_turno_id: number;
  duracion_min: number;
  franjas: FranjaDisponible[];
}
