const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "";

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

export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const url = buildUrl(input);
  const res = await fetch(url, { credentials: "include", ...init });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let body: unknown = null;
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }
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
    throw error;
  }
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}
