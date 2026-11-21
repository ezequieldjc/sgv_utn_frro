export interface Usuario {
  id: number;
  persona_id?: number | null;
  username: string;
  nombre?: string | null;
  apellido?: string | null;
  habilitado: boolean;
  rol_id?: number | null;
  version_token?: string | null;
}

export interface AuthSessionResponse {
  usuario: Usuario;
  permisos: string[];
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CambiarContrasenaObligatorioResponse {
  mensaje: string;
}

// Registro público de un cliente (POST /api/auth/registro).
export interface RegistroPayload {
  nombre: string;
  apellido: string;
  dni: string;
  celular: string;
  mail: string;
  fecha_nacimiento: string | null;
  sexo: "M" | "F" | "X" | null;
  password: string;
  password_repetida: string;
}

export interface RegistroResponse {
  mensaje: string;
  username: string;
}
