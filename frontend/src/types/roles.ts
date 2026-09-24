// TODO: reemplazar por tipo generado desde OpenAPI

export interface PermisoItem {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface RolListItem {
  id: number;
  nombre: string;
}

export interface RolDetail {
  id: number;
  nombre: string;
  descripcion: string | null;
  es_admin: boolean;
  acceso_total: boolean;
  permisos: PermisoItem[];
}

export interface RolCreatePayload {
  nombre: string;
  descripcion: string | null;
}

export interface RolPermisosUpdatePayload {
  permiso_ids: number[];
}

export interface PermisoGroup {
  dominio: string;
  permisos: PermisoItem[];
}
