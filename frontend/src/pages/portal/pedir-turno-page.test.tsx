import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PedirTurnoPage from "@/pages/portal/pedir-turno-page";
import type { PortalTurnoOpciones } from "@/types/portal";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ usuario: { nombre: "Martín" }, permisos: ["portal:ver", "portal:pedir_turno"] }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const OPCIONES: PortalTurnoOpciones = {
  mascotas: [{ id: 1, nombre: "Coco" }],
  tipos: [{ id: 2, nombre: "Consulta", duracion_min: 30 }],
  veterinarios: [{ id: 3, nombre: "Valeria Sosa" }],
  primer_dia: "2026-11-18",
};

const HORARIO = "2026-11-20T12:00:00Z";

function renderPagina() {
  return render(
    <MemoryRouter>
      <PedirTurnoPage />
    </MemoryRouter>,
  );
}

describe("PedirTurnoPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("test_pedir_turno_sin_mascotas_indica_comunicarse_con_la_clinica", async () => {
    apiFetchMock.mockResolvedValue({ ...OPCIONES, mascotas: [] });
    renderPagina();

    expect(await screen.findByText(/comunicate con la clínica/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Mascota")).not.toBeInTheDocument();
  });

  it("test_pedir_turno_busca_horarios_y_envia_el_pedido_con_el_horario_elegido", async () => {
    apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/portal/turnos/opciones") {
        return Promise.resolve(OPCIONES);
      }
      if (url.startsWith("/api/portal/turnos/disponibilidad")) {
        return Promise.resolve({
          fecha: "2026-11-20",
          horarios: [{ fecha_hora_inicio: HORARIO, fecha_hora_fin: "2026-11-20T12:30:00Z" }],
        });
      }
      if (url === "/api/portal/turnos" && init?.method === "POST") {
        return Promise.resolve({
          id: 9,
          mascota_id: 1,
          mascota_nombre: "Coco",
          fecha_hora_inicio: HORARIO,
          fecha_hora_fin: "2026-11-20T12:30:00Z",
          tipo_turno_nombre: "Consulta",
          veterinario_nombre: "Valeria Sosa",
          estado: "solicitado",
          cancelable: true,
        });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });
    renderPagina();

    fireEvent.change(await screen.findByLabelText("Mascota"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tipo de turno"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Veterinario/a"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2026-11-20" } });

    const horario = await screen.findByRole("button", { pressed: false, name: /\d{2}:\d{2}/ });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/portal/turnos/disponibilidad?mascota_id=1&veterinario_id=3&tipo_turno_id=2&fecha=2026-11-20",
    );
    fireEvent.click(horario);
    fireEvent.click(screen.getByRole("button", { name: /Pedir turno/ }));

    expect(await screen.findByText("Tu turno quedó solicitado")).toBeInTheDocument();
    const post = apiFetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post?.[1].body as string)).toEqual({
      mascota_id: 1,
      veterinario_id: 3,
      tipo_turno_id: 2,
      fecha_hora_inicio: HORARIO,
    });
  });

  it("test_pedir_turno_para_hoy_no_busca_horarios", async () => {
    apiFetchMock.mockResolvedValue(OPCIONES);
    renderPagina();

    fireEvent.change(await screen.findByLabelText("Mascota"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tipo de turno"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Veterinario/a"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Día"), { target: { value: "2026-11-17" } });

    expect(await screen.findByText("Elegí un día a partir de mañana.")).toBeInTheDocument();
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  });
});
