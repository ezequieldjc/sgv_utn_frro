import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortalInicioPage from "@/pages/portal/portal-inicio-page";
import type { PortalMascota, PortalTurnosResponse } from "@/types/portal";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ usuario: { nombre: "Martín" }, permisos: ["portal:ver"] }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const MASCOTAS: PortalMascota[] = [
  {
    id: 1,
    nombre: "Coco",
    especie_nombre: "Canina",
    raza_nombre: "Bulldog Francés",
    sexo: "M",
    fecha_nacimiento: null,
    edad_meses: null,
    ultimo_peso: "13.20",
    estado_nombre: "ACTIVA",
    alertas_medicas: "Alérgico a la penicilina",
  },
];

const TURNOS: PortalTurnosResponse = {
  proximos: [
    {
      id: 5,
      mascota_id: 1,
      mascota_nombre: "Coco",
      fecha_hora_inicio: "2026-11-26T12:00:00Z",
      fecha_hora_fin: "2026-11-26T12:30:00Z",
      tipo_turno_nombre: "Control",
      veterinario_nombre: "Valeria Sosa",
      estado: "confirmado",
      cancelable: false,
    },
  ],
  anteriores: [],
};

describe("PortalInicioPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === "/api/portal/mascotas" ? MASCOTAS : TURNOS),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("test_inicio_portal_saluda_y_muestra_mascotas_y_proximos_turnos", async () => {
    render(
      <MemoryRouter>
        <PortalInicioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Hola, Martín")).toBeInTheDocument();
    const coco = await screen.findByRole("link", { name: /Coco/ });
    expect(coco).toHaveAttribute("href", "/portal/mascotas/1");
    expect(screen.getByText("Alérgico a la penicilina")).toBeInTheDocument();
    expect(
      await screen.findByText("Control de Coco con Valeria Sosa"),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirmado")).toBeInTheDocument();
  });

  it("test_inicio_portal_sin_mascotas_muestra_mensaje_vacio", async () => {
    apiFetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === "/api/portal/mascotas" ? [] : { proximos: [], anteriores: [] }),
    );
    render(
      <MemoryRouter>
        <PortalInicioPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Todavía no tenés mascotas registradas en la clínica."),
    ).toBeInTheDocument();
    expect(screen.getByText("No tenés turnos próximos.")).toBeInTheDocument();
  });
});
