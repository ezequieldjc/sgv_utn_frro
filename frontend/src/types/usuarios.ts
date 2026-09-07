// TODO: reemplazar por tipo generado desde OpenAPI
export interface UsuarioListItem {
  id: number;
  username: string;
  nombre: string;
  apellido: string;
  habilitado: boolean;
  rol_id: number;
  rol_nombre: string;
  ultimo_inicio_sesion: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface RolListItem {
  id: number;
  nombre: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface UsuarioCreateResponse {
  id: number;
  username: string;
  password_temporal: string;
  debe_cambiar: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface UsuarioRestablecerResponse {
  mensaje: string;
  usuario_id: number;
  username: string;
  password_temporal: string;
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
export interface UsuarioCreatePayload {
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: "M" | "F" | "X";
  celular: string;
  mail: string | null;
  domicilio: DomicilioCreatePayload;
  rol_id: number;
  habilitado: boolean;
}
