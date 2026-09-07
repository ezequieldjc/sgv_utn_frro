// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteListItem {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  sexo: string;
  celular: string;
  fecha_alta: string;
  ciudad: string | null;
  edad: number;
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
  dni: string;
  fecha_nacimiento: string;
  sexo: "M" | "F" | "X";
  celular: string;
  mail: string | null;
  domicilio: DomicilioCreatePayload;
  crear_usuario: boolean;
  habilitado: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface ClienteCreateResponse {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  usuario_creado: boolean;
  username: string | null;
  password_temporal: string | null;
}
