import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import ClienteFormPage, {
  buildClientePayload,
  INITIAL_FORM,
  validateForm,
} from "@/pages/clientes/cliente-form-page";
import type { ClienteCreatePayload } from "@/types/clientes";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: ["clientes:crear"] }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

describe("alta rápida de clientes", () => {
  it("test_validacion_campos_opcionales_vacios_solo_exige_nombre_apellido_y_celular", () => {
    const errors = validateForm(INITIAL_FORM);

    expect(errors).toEqual({
      nombre: "El nombre es obligatorio.",
      apellido: "El apellido es obligatorio.",
      celular: "El celular es obligatorio.",
    });
  });

  it("test_validacion_domicilio_activado_exige_campos_estructurales", () => {
    const errors = validateForm({
      ...INITIAL_FORM,
      nombre: "Ana",
      apellido: "Pérez",
      celular: "3415550000",
      incluir_domicilio: true,
    });

    expect(errors.ciudad).toBeDefined();
    expect(errors.calle).toBeDefined();
    expect(errors.altura).toBeDefined();
    expect(errors.cp).toBeDefined();
  });

  it("test_payload_domicilio_desactivado_envia_nulls_en_campos_opcionales", () => {
    const payload = buildClientePayload({
      ...INITIAL_FORM,
      nombre: " Ana ",
      apellido: " Pérez ",
      celular: "341 555-0000",
    });

    expect(payload).toMatchObject({
      nombre: "Ana",
      apellido: "Pérez",
      celular: "3415550000",
      dni: null,
      sexo: null,
      fecha_nacimiento: null,
      mail: null,
      domicilio: null,
    });
  });

  it("test_submit_sin_dni_pide_confirmacion_y_solo_crea_despues_de_aceptar", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({
      id: 1,
      nombre: "Ana",
      apellido: "Pérez",
      dni: null,
      usuario_creado: false,
      username: null,
      password_temporal: null,
    });

    render(
      <MemoryRouter>
        <ClienteFormPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Celular"), "3415550000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Crear cliente sin DNI")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Crear sin DNI" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const [, requestInit] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body)) as ClienteCreatePayload;
    expect(payload.dni).toBeNull();
    expect(payload.domicilio).toBeNull();
  });
});
