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
  mail: string | null;
  domicilio: DomicilioCreatePayload | null;
  crear_usuario: boolean;
  habilitado: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteCreateResponse {
  id: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  usuario_creado: boolean;
  username: string | null;
  password_temporal: string | null;
}
