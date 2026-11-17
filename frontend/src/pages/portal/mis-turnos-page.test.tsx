import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MisTurnosPage from "@/pages/portal/mis-turnos-page";
import type { PortalTurno } from "@/types/portal";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: ["portal:ver", "portal:pedir_turno"] }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function turno(id: number, estado: string, cancelable: boolean): PortalTurno {
  return {
    id,
    mascota_id: 1,
    mascota_nombre: "Coco",
    fecha_hora_inicio: "2026-11-26T12:00:00Z",
    fecha_hora_fin: "2026-11-26T12:30:00Z",
    tipo_turno_nombre: estado === "solicitado" ? "Consulta" : "Control",
    veterinario_nombre: "Valeria Sosa",
    estado,
    cancelable,
  };
}

describe("MisTurnosPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return Promise.resolve(turno(1, "cancelado", false));
      }
      return Promise.resolve({
        proximos: [turno(1, "solicitado", true), turno(2, "confirmado", false)],
        anteriores: [],
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("test_mis_turnos_solo_permite_cancelar_el_solicitado", async () => {
    render(
      <MemoryRouter>
        <MisTurnosPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByRole("button", { name: "Cancelar turno" })).toHaveLength(1);
    expect(screen.getByText(/comunicate con la clínica para\s+cancelarlo/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedir turno/ })).toHaveAttribute(
      "href",
      "/portal/turnos/nuevo",
    );
  });

  it("test_mis_turnos_cancelar_pide_confirmacion_y_llama_al_endpoint", async () => {
    render(
      <MemoryRouter>
        <MisTurnosPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar turno" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cancelar" }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/portal/turnos/1/cancelar", {
        method: "POST",
      }),
    );
  });
});
