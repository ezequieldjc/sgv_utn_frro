import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MascotaVacunasPage from "@/pages/mascotas/mascota-vacunas-page";
import type { ProductoPreventivoOpcion, VacunasMascotaResponse } from "@/types/vacunas";

const { apiFetchMock, authState } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  authState: { permisos: ["vacunas:registrar"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: authState.permisos }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const CARNET: VacunasMascotaResponse = {
  hoy: "2026-11-17",
  mascota: {
    id: 10,
    nombre: "Felipe",
    especie_nombre: "Canina",
    raza_nombre: "Shar Pei",
    tutor_id: 5,
    tutor_nombre: "Joaquín Ferreyra",
    ultimo_peso: "21.50",
    estado_nombre: "Activo",
    atendible: true,
  },
  items: [
    {
      id: 3,
      mascota_id: 10,
      tipo: "vacunacion",
      producto_id: null,
      nombre_producto: "Séxtuple (libreta)",
      aplicada_en_clinica: false,
      fecha_aplicacion: "2025-11-20",
      fecha_proxima_dosis: "2026-11-20",
      estado_dosis: "por_vencer",
      dias_para_vencer: 3,
      lote: null,
      peso_kg: null,
      refuerzo_de_id: null,
      reforzada_por_id: null,
      consulta_id: null,
      turno_id: null,
      venta_id: null,
      usuario_nombre: "Valeria Sosa",
      observaciones: null,
      fecha_registro: "2026-11-17T20:00:00Z",
    },
  ],
  config: {
    dias_refuerzo_vacuna: 365,
    dias_refuerzo_desparasitacion: 90,
    dias_aviso_dosis: 7,
    dias_aviso_dosis_vencida: 30,
  },
};

const PRODUCTOS: ProductoPreventivoOpcion[] = [
  {
    id: 41,
    nombre: "Vacuna Séxtuple",
    tipo: "vacunacion",
    rubro_nombre: "Vacuna",
    unidad: "unidad",
    envases_cerrados: 8,
    precio_venta: "18000",
  },
  {
    id: 42,
    nombre: "Antiparasitario interno",
    tipo: "desparasitacion",
    rubro_nombre: "Antiparasitario",
    unidad: "comprimido",
    envases_cerrados: 20,
    precio_venta: "3000",
  },
];

function renderPage(ruta = "/mascotas/10/vacunas?turno_id=21") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/mascotas/:id/vacunas" element={<MascotaVacunasPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  authState.permisos = ["vacunas:registrar"];
  apiFetchMock.mockReset();
  apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/vacunas/productos") {
      return Promise.resolve(PRODUCTOS);
    }
    if (url === "/api/vacunas" && init?.method === "POST") {
      return Promise.resolve({
        item: { ...CARNET.items[0], id: 9, nombre_producto: "Vacuna Séxtuple", aplicada_en_clinica: true },
        venta_id: 77,
        venta_total: "18000",
        turno_atendido: true,
        advertencias: [],
      });
    }
    return Promise.resolve(CARNET);
  });
});

afterEach(() => {
  cleanup();
});

describe("Vacunas de la mascota", () => {
  it("test_muestra_el_carnet_con_el_estado_de_la_dosis", async () => {
    renderPage();
    expect(await screen.findByText("Vacunas y desparasitaciones de Felipe")).toBeInTheDocument();
    expect(screen.getByText("Séxtuple (libreta)")).toBeInTheDocument();
    expect(screen.getByText("Vence en 3 días")).toBeInTheDocument();
    expect(screen.getByText(/al guardar, el turno queda atendido/)).toBeInTheDocument();
  });

  it("test_aplicar_propone_el_refuerzo_y_manda_el_cobro_con_el_turno", async () => {
    renderPage();
    const producto = await screen.findByLabelText("Producto");
    await waitFor(() => expect(screen.getByRole("option", { name: /Vacuna Séxtuple/ })).toBeInTheDocument());
    fireEvent.change(producto, { target: { value: "41" } });

    // La séxtuple de la libreta vence en 3 días: se propone como la dosis que se completa.
    await waitFor(() =>
      expect((screen.getByLabelText("¿Completa una dosis anterior?") as HTMLSelectElement).value).toBe("3"),
    );
    fireEvent.change(screen.getByLabelText("Medio de pago"), { target: { value: "debito" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar aplicación/ }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/api/vacunas", expect.objectContaining({ method: "POST" })),
    );
    const [, init] = apiFetchMock.mock.calls.find(
      ([url, opciones]) => url === "/api/vacunas" && (opciones as RequestInit)?.method === "POST",
    )!;
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      mascota_id: 10,
      modo: "aplicar",
      producto_id: 41,
      fecha_proxima_dosis: "2027-11-17",
      refuerzo_de_id: 3,
      cobrar: true,
      medio_pago: "debito",
      turno_id: 21,
      peso_kg: "21.5",
    });
    expect(await screen.findByText(/Venta #77/)).toBeInTheDocument();
    expect(screen.getByText(/El turno quedó atendido/)).toBeInTheDocument();
  });

  it("test_dosis_anterior_no_propone_el_peso_de_hoy", async () => {
    renderPage();
    const peso = (await screen.findByLabelText("Peso (kg)")) as HTMLInputElement;
    expect(peso.value).toBe("21.5");

    fireEvent.click(screen.getByRole("button", { name: "Dosis anterior" }));
    expect((screen.getByLabelText("Peso (kg)") as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Aplicar ahora" }));
    expect((screen.getByLabelText("Peso (kg)") as HTMLInputElement).value).toBe("21.5");
  });

  it("test_sin_producto_no_llama_al_backend", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Registrar aplicación/ }));
    expect(await screen.findByText("Elegí el producto del stock.")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/vacunas", expect.objectContaining({ method: "POST" }));
  });

  it("test_solo_lectura_sin_permiso_de_registrar", async () => {
    authState.permisos = ["vacunas:ver"];
    renderPage("/mascotas/10/vacunas");
    expect(await screen.findByText("Séxtuple (libreta)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar aplicación/ })).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/vacunas/productos");
  });
});
