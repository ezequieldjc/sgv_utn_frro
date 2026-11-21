import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PortalConsultaPage from "@/pages/portal/portal-consulta-page";
import type { PortalConsultaDetalle } from "@/types/portal";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const CONTROL: PortalConsultaDetalle = {
  id: 7,
  fecha_hora: "2026-11-26T12:00:00Z",
  veterinario_nombre: "Valeria Sosa",
  mascota_id: 1,
  mascota_nombre: "Coco",
  motivo: "Control",
  peso_kg: "13.00",
  temperatura_c: "38.5",
  tratamiento: "Seguir con reposo.",
  diagnosticos: [
    { nombre: "Sobrepeso", principal: false },
    { nombre: "Síndrome braquicefálico", principal: true },
  ],
  control_de: { id: 3, fecha_hora: "2026-11-16T12:00:00Z" },
};

function renderPagina(id = "7") {
  return render(
    <MemoryRouter initialEntries={[`/portal/consultas/${id}`]}>
      <Routes>
        <Route path="/portal/consultas/:id" element={<PortalConsultaPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PortalConsultaPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("test_consulta_portal_muestra_diagnosticos_tratamiento_y_enlace_al_control", async () => {
    apiFetchMock.mockResolvedValue(CONTROL);
    renderPagina();

    expect(await screen.findByText("Consulta de Coco")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/portal/consultas/7");
    expect(screen.getByText("Síndrome braquicefálico")).toBeInTheDocument();
    expect(screen.getByText("Principal")).toBeInTheDocument();
    expect(screen.getByText("Seguir con reposo.")).toBeInTheDocument();
    expect(screen.getByText("13 kg")).toBeInTheDocument();
    const enlace = screen.getByRole("link", { name: /consulta del 16\/11\/2026/ });
    expect(enlace).toHaveAttribute("href", "/portal/consultas/3");
  });

  it("test_consulta_portal_404_muestra_mensaje_sin_confirmar_que_existe", async () => {
    apiFetchMock.mockRejectedValue(Object.assign(new Error("no"), { status: 404 }));
    renderPagina("99");

    expect(await screen.findByText("No encontramos esa consulta.")).toBeInTheDocument();
  });
});
