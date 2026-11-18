// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteListItem {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  sexo: string | null;
  celular: string;
  fecha_alta: string;
  ciudad: string | null;
  edad: number | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface DomicilioCreatePayload {
  pais: string;
  provincia: string;
  ciudad: string;
  calle: string;
  altura: string;
  cp: string;
  departamento: string | null;
  notas: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteCreatePayload {
  nombre: string;
  apellido: string;
  dni: string | null;
  fecha_nacimiento: string | null;
  sexo: "M" | "F" | "X" | null;
  celular: string;
  /** Obligatorio: es el usuario del cliente (se guarda en minúsculas). */
  mail: string;
  domicilio: DomicilioCreatePayload | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteCreateResponse {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  /** El mail del cliente, en minúsculas. */
  username: string;
  password_temporal: string;
}
