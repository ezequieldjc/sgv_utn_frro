import type { PublicConfig } from "@/types/config";

export function applyBrandingToDocument(config: PublicConfig): string {
  const brand = config.razon_social || config.clinic_name || "SGV";

  document.title = brand;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.type = "image/svg+xml";
  favicon.href = "/paw-print.svg";

  return brand;
}
