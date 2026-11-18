import { afterEach, describe, expect, it, vi } from "vitest";

import { EVENTO_SESION_EXPIRADA, apiDescargar, apiFetch, nombreDeArchivo } from "@/lib/api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VENCIDO = { error: "TOKEN_EXPIRADO", detalle: "El token expiró" };

function urls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch con sesión vencida", () => {
  it("test_renueva_la_sesion_y_repite_la_llamada", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, VENCIDO))
      .mockResolvedValueOnce(json(200, { usuario: {}, permisos: [] }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/agenda/turnos")).resolves.toEqual({ ok: true });
    expect(urls(fetchMock)).toEqual([
      "/api/agenda/turnos",
      "/api/auth/refresh",
      "/api/agenda/turnos",
    ]);
  });

  it("test_si_no_se_puede_renovar_avisa_y_tira_el_error_original", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, VENCIDO))
      .mockResolvedValueOnce(json(401, { error: "SESION_EXPIRADA", detalle: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    const aviso = vi.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, aviso);

    await expect(apiFetch("/api/agenda/turnos")).rejects.toMatchObject({
      status: 401,
      body: VENCIDO,
    });
    expect(aviso).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESION_EXPIRADA, aviso);
  });

  it("test_otros_401_no_disparan_renovacion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: "TOKEN_INVALIDO", detalle: "x" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(urls(fetchMock)).toEqual(["/api/auth/me"]);
  });

  it("test_el_login_nunca_dispara_renovacion", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(401, VENCIDO));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
    });
    expect(urls(fetchMock)).toEqual(["/api/auth/login"]);
  });

  it("test_llamadas_vencidas_a_la_vez_comparten_una_sola_renovacion", async () => {
    let liberarRenovacion: (res: Response) => void = () => undefined;
    const renovacion = new Promise<Response>((resolve) => {
      liberarRenovacion = resolve;
    });
    const fetchMock = vi.fn((url: RequestInfo) => {
      const ruta = String(url);
      if (ruta === "/api/auth/refresh") {
        return renovacion;
      }
      const yaRenovo = fetchMock.mock.calls.some(([u]) => String(u) === "/api/auth/refresh");
      return Promise.resolve(yaRenovo ? json(200, { ruta }) : json(401, VENCIDO));
    });
    vi.stubGlobal("fetch", fetchMock);

    const primera = apiFetch("/api/consultas/1");
    const segunda = apiFetch("/api/consultas/1/sugerencias");
    await vi.waitFor(() => {
      expect(urls(fetchMock).filter((u) => u === "/api/auth/refresh")).toHaveLength(1);
    });
    liberarRenovacion(json(200, { usuario: {}, permisos: [] }));

    await expect(primera).resolves.toEqual({ ruta: "/api/consultas/1" });
    await expect(segunda).resolves.toEqual({ ruta: "/api/consultas/1/sugerencias" });
    expect(urls(fetchMock).filter((u) => u === "/api/auth/refresh")).toHaveLength(1);
  });
});

describe("apiDescargar", () => {
  it("test_toma_el_nombre_del_header_y_descarga_el_archivo", async () => {
    const pdf = new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="receta-felipe-2026-11-17.pdf"',
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(pdf));
    const crear = vi.fn(() => "blob:receta");
    vi.stubGlobal("URL", { ...URL, createObjectURL: crear, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await expect(apiDescargar("/api/consultas/7/receta.pdf", "receta.pdf")).resolves.toBe(
      "receta-felipe-2026-11-17.pdf",
    );
    expect(crear).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it("test_un_error_del_backend_se_propaga_con_su_detalle", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        json(409, { error: "RECETA_SIN_INDICACIONES", detalle: "La consulta no tiene indicaciones" }),
      ),
    );
    await expect(apiDescargar("/api/consultas/7/receta.pdf")).rejects.toMatchObject({
      status: 409,
      message: "La consulta no tiene indicaciones",
    });
  });
});

describe("nombreDeArchivo", () => {
  it("test_lee_el_nombre_o_usa_el_de_respaldo", () => {
    expect(nombreDeArchivo('attachment; filename="a.pdf"', "x")).toBe("a.pdf");
    expect(nombreDeArchivo("attachment; filename=b.pdf", "x")).toBe("b.pdf");
    expect(nombreDeArchivo(null, "x.pdf")).toBe("x.pdf");
  });
});
