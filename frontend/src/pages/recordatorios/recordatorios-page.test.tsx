import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RecordatoriosPage from "@/pages/recordatorios/recordatorios-page";
import type { RecordatoriosResponse } from "@/types/recordatorios";

const { apiFetchMock, authState } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  authState: { permisos: ["recordatorios:enviar"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: authState.permisos }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const URL_TURNO = "https://wa.me/5493406419004?text=Hola";

const DATA: RecordatoriosResponse = {
  hoy: "2026-11-17",
  fecha_turnos: "2026-11-18",
  dias_aviso_dosis: 7,
  dias_aviso_dosis_vencida: 30,
  turnos: [
    {
      turno_id: 21,
      fecha_hora_inicio: "2026-11-18T13:00:00Z",
      estado_turno: "confirmado",
      tipo_turno: "Consulta",
      veterinario_nombre: "Valeria Sosa",
      mascota_id: 11,
      mascota_nombre: "Simón",
      tutor: {
        persona_id: 5,
        nombre: "Joaquín Ferreyra",
        celular: "3406419004",
        whatsapp: "5493406419004",
        motivo_sin_whatsapp: null,
      },
      mensaje: "¡Hola Joaquín! Te recordamos el turno de Simón…",
      url_whatsapp: URL_TURNO,
      envios: 0,
      ultimo_envio: null,
    },
  ],
  dosis: [
    {
      tratamiento_preventivo_id: 3,
      tipo: "vacunacion",
      nombre_producto: "Séxtuple",
      fecha_aplicacion: "2025-11-20",
      fecha_proxima_dosis: "2026-11-20",
      dias_para_vencer: 3,
      mascota_id: 10,
      mascota_nombre: "Felipe",
      tutor: {
        persona_id: 7,
        nombre: "Tutor Eventual",
        celular: "0",
        whatsapp: null,
        motivo_sin_whatsapp: "Tutor eventual: no tiene un contacto registrado",
      },
      mensaje: "…",
      url_whatsapp: null,
      envios: 0,
      ultimo_envio: null,
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <RecordatoriosPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.permisos = ["recordatorios:enviar"];
  apiFetchMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Recordatorios", () => {
  it("test_sin_permiso_muestra_acceso_denegado", () => {
    authState.permisos = ["agenda:ver"];
    renderPage();
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("test_enviar_abre_whatsapp_y_registra_el_envio", async () => {
    apiFetchMock.mockImplementation((url: string) =>
      Promise.resolve(url === "/api/recordatorios" ? { id: 1 } : DATA),
    );
    renderPage();

    const link = await screen.findByRole("link", { name: /Enviar por WhatsApp/ });
    expect(link).toHaveAttribute("href", URL_TURNO);
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Turnos de mañana miércoles 18/11", { exact: false })).toBeInTheDocument();

    fireEvent.click(link);
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/recordatorios",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ turno_id: 21 }) }),
      ),
    );
  });

  it("test_sin_whatsapp_muestra_el_motivo_en_lugar_del_boton", async () => {
    apiFetchMock.mockResolvedValue(DATA);
    renderPage();
    expect(
      await screen.findByText("Tutor eventual: no tiene un contacto registrado"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Enviar por WhatsApp/ })).toHaveLength(1);
  });
});
