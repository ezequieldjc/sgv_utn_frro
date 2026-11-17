// Respuestas de /api/portal (backend/app/schemas/portal.py). Solo lo que ve el cliente.

export interface PortalMascota {
  id: number;
  nombre: string;
  especie_nombre: string;
  raza_nombre: string;
  sexo: string | null;
  fecha_nacimiento: string | null;
  edad_meses: number | null;
  ultimo_peso: string | null;
  estado_nombre: string;
  alertas_medicas: string | null;
}

export interface PortalConsultaItem {
  id: number;
  fecha_hora: string;
  veterinario_nombre: string;
  motivo: string | null;
  diagnostico_principal: string | null;
  es_control: boolean;
}

export interface PortalDiagnostico {
  nombre: string;
  principal: boolean;
}

export interface PortalConsultaDetalle {
  id: number;
  fecha_hora: string;
  veterinario_nombre: string;
  mascota_id: number;
  mascota_nombre: string;
  motivo: string | null;
  peso_kg: string | null;
  temperatura_c: string | null;
  tratamiento: string | null;
  diagnosticos: PortalDiagnostico[];
  control_de: { id: number; fecha_hora: string } | null;
}

export interface PortalTurno {
  id: number;
  mascota_id: number;
  mascota_nombre: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  tipo_turno_nombre: string;
  veterinario_nombre: string;
  estado: string;
  /** Solo un turno futuro que siga solicitado; uno confirmado se cancela llamando. */
  cancelable: boolean;
}

export interface PortalTurnosResponse {
  proximos: PortalTurno[];
  anteriores: PortalTurno[];
}

export interface PortalOpcion {
  id: number;
  nombre: string;
}

export interface PortalTurnoOpciones {
  mascotas: PortalOpcion[];
  tipos: (PortalOpcion & { duracion_min: number })[];
  veterinarios: PortalOpcion[];
  /** Primer día que se puede pedir (mañana), en formato YYYY-MM-DD. */
  primer_dia: string;
}

export interface PortalHorario {
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
}

export interface PortalDisponibilidad {
  fecha: string;
  horarios: PortalHorario[];
}

export interface PortalTurnoCreate {
  mascota_id: number;
  veterinario_id: number;
  tipo_turno_id: number;
  fecha_hora_inicio: string;
}

export interface PortalCompraItem {
  id: number;
  fecha: string;
  total: string;
  medio_pago: string;
  cantidad_items: number;
}

export interface PortalCompraDetalle {
  id: number;
  fecha: string;
  total: string;
  medio_pago: string;
  items: {
    producto_nombre: string;
    cantidad: number;
    precio_unitario: string;
    subtotal: string;
  }[];
}
