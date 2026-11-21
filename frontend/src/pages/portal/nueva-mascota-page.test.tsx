import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validarNuevaMascota } from "@/lib/portal";
import NuevaMascotaPage from "@/pages/portal/nueva-mascota-page";

const { apiFetchMock, permisosMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  permisosMock: { value: ["portal:ver", "portal:crear_mascota"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ usuario: { nombre: "Ana" }, permisos: permisosMock.value }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const ESPECIES = [
  { id: 3, nombre: "Exótica" },
  { id: 2, nombre: "Felina" },
  { id: 1, nombre: "Canina" },
];
const RAZAS = [{ id: 10, nombre: "Labrador", especie_id: 1 }];

function mockApi() {
  apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/portal/mascotas/especies") return Promise.resolve(ESPECIES);
    if (url.startsWith("/api/portal/mascotas/razas")) return Promise.resolve(RAZAS);
    if (url === "/api/portal/mascotas" && init?.method === "POST") {
      return Promise.resolve({ id: 99, nombre: "Firulais" });
    }
    return Promise.reject(new Error(`no mockeado: ${url}`));
  });
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={["/portal/mascotas/nueva"]}>
      <Routes>
        <Route path="/portal/mascotas/nueva" element={<NuevaMascotaPage />} />
        <Route path="/portal/mascotas/:id" element={<p>ficha de la mascota</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("NuevaMascotaPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    permisosMock.value = ["portal:ver", "portal:crear_mascota"];
    mockApi();
  });

  afterEach(() => {
    cleanup();
  });

  it("test_validar_nueva_mascota_exige_nombre_especie_y_raza", () => {
    const errores = validarNuevaMascota({
      nombre: " ",
      especie_id: "",
      raza_id: "",
      sexo: "",
      fecha_nacimiento: "",
    });

    expect(Object.keys(errores).sort()).toEqual(["especie_id", "nombre", "raza_id"]);
  });

  it("test_validar_nueva_mascota_fecha_futura_devuelve_error", () => {
    const errores = validarNuevaMascota(
      { nombre: "Coco", especie_id: "1", raza_id: "10", sexo: "", fecha_nacimiento: "2030-01-01" },
      "2026-11-18",
    );

    expect(errores).toEqual({ fecha_nacimiento: "La fecha de nacimiento no puede ser futura." });
  });

  it("test_nueva_mascota_sin_permiso_muestra_acceso_denegado", () => {
    permisosMock.value = ["portal:ver"];
    renderPagina();

    expect(screen.getByText(/no puede dar de alta mascotas/)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("test_nueva_mascota_canina_y_felina_aparecen_primero", async () => {
    renderPagina();

    const select = await screen.findByLabelText("Especie");
    const opciones = Array.from((select as HTMLSelectElement).options).map((o) => o.text);
    expect(opciones).toEqual(["Elegí…", "Canina", "Felina", "Exótica"]);
  });

  it("test_nueva_mascota_guarda_sin_persona_y_va_a_la_ficha", async () => {
    const user = userEvent.setup();
    renderPagina();

    await user.type(await screen.findByLabelText("Nombre"), "Firulais");
    await user.selectOptions(screen.getByLabelText("Especie"), "1");
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Labrador" })).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText("Raza"), "10");
    await user.selectOptions(screen.getByLabelText("Sexo (opcional)"), "M");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("ficha de la mascota")).toBeInTheDocument();
    const post = apiFetchMock.mock.calls.find(
      ([url, init]) => url === "/api/portal/mascotas" && (init as RequestInit)?.method === "POST",
    );
    const body = JSON.parse(String((post?.[1] as RequestInit).body));
    expect(body).toEqual({
      nombre: "Firulais",
      especie_id: 1,
      raza_id: 10,
      sexo: "M",
      fecha_nacimiento: null,
    });
    expect(body).not.toHaveProperty("persona_id");
  });

  it("test_nueva_mascota_sin_raza_no_llama_a_la_api", async () => {
    const user = userEvent.setup();
    renderPagina();

    await user.type(await screen.findByLabelText("Nombre"), "Firulais");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Elegí la especie.")).toBeInTheDocument();
    expect(screen.getByText("Elegí la raza.")).toBeInTheDocument();
    expect(
      apiFetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === "POST"),
    ).toBe(false);
  });
});
