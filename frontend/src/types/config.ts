// TODO: reemplazar por tipo generado desde OpenAPI

export interface PublicConfig {
  razon_social: string;
  clinic_name?: string;
}

export interface ConfigItem {
  id: number;
  config_id: number;
  config_nombre: string;
  parametro_id: number;
  parametro_nombre: string;
  parametro_valor: string;
}

export interface ConfigValorUpdatePayload {
  parametro_valor: string;
}

export interface ConfigGroup {
  config_nombre: string;
  items: ConfigItem[];
}
