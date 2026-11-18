const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "";

/** Se dispara cuando la sesión venció y no se pudo renovar: el AuthProvider manda al login. */
export const EVENTO_SESION_EXPIRADA = "auth:sesion-expirada";

// Llamadas que nunca disparan una renovación: o son la renovación misma, o no usan la sesión.
const RUTAS_SIN_RENOVACION = [
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/cambiar-contrasena-obligatorio",
  "/api/auth/registro",
];

function buildUrl(input: RequestInfo): RequestInfo {
  if (typeof input !== "string") {
    return input;
  }
  if (input.startsWith("http://") || input.startsWith("https://")) {
    return input;
  }
  if (input.startsWith("/api")) {
    return `${BASE}${input}`;
  }
  return input;
}

function puedeRenovar(input: RequestInfo): boolean {
  return typeof input === "string" && !RUTAS_SIN_RENOVACION.some((ruta) => input.startsWith(ruta));
}

async function leerCuerpo(res: Response): Promise<unknown> {
  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

function codigoDeError(body: unknown): string | null {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
    ? (body as { error: string }).error
    : null;
}

let renovacionEnCurso: Promise<boolean> | null = null;

/**
 * Pide un access token nuevo con la cookie de renovación (HttpOnly, el navegador la manda solo).
 * Si varias llamadas vencen a la vez, comparten el mismo pedido.
 */
function renovarSesion(): Promise<boolean> {
  if (renovacionEnCurso === null) {
    renovacionEnCurso = fetch(buildUrl("/api/auth/refresh"), {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        renovacionEnCurso = null;
      });
  }
  return renovacionEnCurso;
}

/** Hace la llamada y, si el access token venció, lo renueva una vez y la repite. */
async function fetchConRenovacion(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const url = buildUrl(input);
  let res = await fetch(url, { credentials: "include", ...init });

  // El access token dura pocos minutos: si venció, se renueva una vez y se repite la llamada.
  if (res.status === 401 && puedeRenovar(input)) {
    const codigo = codigoDeError(await leerCuerpo(res.clone()));
    if (codigo === "TOKEN_EXPIRADO") {
      if (await renovarSesion()) {
        res = await fetch(url, { credentials: "include", ...init });
      } else {
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
      }
    }
  }
  return res;
}

async function errorDeRespuesta(res: Response): Promise<Error & { status?: number; body?: unknown }> {
  const body = await leerCuerpo(res);
  const detalle =
    typeof body === "object" &&
    body !== null &&
    "detalle" in body &&
    typeof (body as { detalle: unknown }).detalle === "string"
      ? (body as { detalle: string }).detalle
      : res.statusText;
  const error = new Error(detalle) as Error & { status?: number; body?: unknown };
  error.status = res.status;
  error.body = body;
  return error;
}

export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetchConRenovacion(input, init);
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    throw await errorDeRespuesta(res);
  }
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

/** Nombre de archivo del header Content-Disposition (attachment; filename="x.pdf"). */
export function nombreDeArchivo(contentDisposition: string | null, porDefecto: string): string {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition ?? "");
  return match ? decodeURIComponent(match[1].trim()) : porDefecto;
}

/**
 * Descarga un archivo de la API (por ejemplo, el PDF de una receta) con la sesión del usuario:
 * renueva el token si hace falta y guarda el archivo con el nombre que manda el backend.
 */
export async function apiDescargar(input: string, porDefecto = "archivo"): Promise<string> {
  const res = await fetchConRenovacion(input);
  if (!res.ok) {
    throw await errorDeRespuesta(res);
  }
  const nombre = nombreDeArchivo(res.headers.get("content-disposition"), porDefecto);
  const url = URL.createObjectURL(await res.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después: algunos navegadores todavía están leyendo el blob al volver del click.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return nombre;
}
