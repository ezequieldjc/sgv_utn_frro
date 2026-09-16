// TODO: reemplazar por tipo generado desde OpenAPI
export type CatalogoSlug =
  | "habitats"
  | "tamanios"
  | "pelajes"
  | "temperamentos"
  | "estados-reproductivos"
  | "mascota-estados";

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CatalogoNavItem {
  slug: CatalogoSlug;
  label: string;
  singularLabel: string;
  requiereEspecie: boolean;
  apiPath: string;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface EspecieOpcion {
  id: number;
  nombre: string;
  activo: boolean;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CatalogoItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  especie_id: number | null;
  especie_nombre: string | null;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CatalogoConEspeciePayload {
  nombre: string;
  descripcion: string | null;
  especie_id: number;
}

// TODO: reemplazar por tipo generado desde OpenAPI
export interface CatalogoGlobalPayload {
  nombre: string;
  descripcion: string | null;
}

export const CATALOGO_NAV: CatalogoNavItem[] = [
  {
    slug: "habitats",
    label: "Hábitats",
    singularLabel: "Hábitat",
    requiereEspecie: true,
    apiPath: "/api/catalogos/habitats",
  },
  {
    slug: "tamanios",
    label: "Tamaños",
    singularLabel: "Tamaño",
    requiereEspecie: true,
    apiPath: "/api/catalogos/tamanios",
  },
  {
    slug: "pelajes",
    label: "Pelajes",
    singularLabel: "Pelaje",
    requiereEspecie: true,
    apiPath: "/api/catalogos/pelajes",
  },
  {
    slug: "temperamentos",
    label: "Temperamentos",
    singularLabel: "Temperamento",
    requiereEspecie: true,
    apiPath: "/api/catalogos/temperamentos",
  },
  {
    slug: "estados-reproductivos",
    label: "Estados reproductivos",
    singularLabel: "Estado reproductivo",
    requiereEspecie: true,
    apiPath: "/api/catalogos/estados-reproductivos",
  },
  {
    slug: "mascota-estados",
    label: "Estados de mascota",
    singularLabel: "Estado de mascota",
    requiereEspecie: false,
    apiPath: "/api/catalogos/mascota-estados",
  },
];
