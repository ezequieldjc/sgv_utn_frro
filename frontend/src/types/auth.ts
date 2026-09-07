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
