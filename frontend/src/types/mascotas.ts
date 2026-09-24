// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaListItem {
  id: number;
  nombre: string;
  especie_id: number;
  especie_nombre: string;
  raza_id: number;
  raza_nombre: string;
  persona_id: number;
  tutor_nombre: string;
  tutor_apellido: string;
  tutor_dni: string | null;
  mascota_estado_id: number;
  mascota_estado_nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaListResponse {
  items: MascotaListItem[];
  total: number;
  page: number;
  page_size: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaCreatePayload {
  persona_id: number | null;
  tutor_eventual: boolean;
  nombre: string;
  especie_id: number;
  raza_id: number;
  sexo: "M" | "H" | "U" | null;
  fecha_nacimiento: string | null;
  peso_inicial_kg: number | null;
  microchip: string | null;
  alertas_medicas: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaCreateResponse {
  id: number;
  nombre: string;
  persona_id: number;
  raza_id: number;
  mascota_estado_id: number;
  peso_registrado: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface TutorOpcion {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CatalogoOpcion {
  id: number;
  nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface RazaOpcion {
  id: number;
  nombre: string;
  especie_id: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaDetail {
  id: number;
  nombre: string;
  especie_id: number;
  especie_nombre: string;
  raza_id: number;
  raza_nombre: string;
  persona_id: number;
  tutor_nombre: string;
  tutor_apellido: string;
  tutor_dni: string | null;
  mascota_estado_id: number;
  mascota_estado_nombre: string;
  sexo: "M" | "H" | "U" | null;
  fecha_nacimiento: string | null;
  microchip: string | null;
  alertas_medicas: string | null;
  pelaje_id: number | null;
  tamanio_id: number | null;
  habitat_id: number | null;
  estado_reproductivo_id: number | null;
  temperamento_id: number | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface MascotaUpdatePayload {
  nombre?: string;
  persona_id?: number;
  raza_id?: number;
  mascota_estado_id?: number;
  sexo?: "M" | "H" | "U" | null;
  fecha_nacimiento?: string | null;
  microchip?: string | null;
  alertas_medicas?: string | null;
  pelaje_id?: number | null;
  tamanio_id?: number | null;
  habitat_id?: number | null;
  estado_reproductivo_id?: number | null;
  temperamento_id?: number | null;
}
