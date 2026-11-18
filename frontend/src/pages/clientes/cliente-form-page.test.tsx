import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  apiFetchMock.mockReset();
  // jsdom no implementa scrollIntoView: el formulario lo usa para llevar al primer error.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("alta rápida de clientes", () => {
  it("test_validacion_campos_vacios_exige_nombre_apellido_celular_y_mail", () => {
    const errors = validateForm(INITIAL_FORM);

    expect(errors).toEqual({
      nombre: "El nombre es obligatorio.",
      apellido: "El apellido es obligatorio.",
      celular: "El celular es obligatorio.",
      mail: "El email es obligatorio: es el usuario del cliente para entrar al portal.",
    });
  });

  it("test_validacion_mail_invalido_devuelve_error", () => {
    const errors = validateForm({
      ...INITIAL_FORM,
      nombre: "Ana",
      apellido: "Pérez",
      celular: "3415550000",
      mail: "ana@",
    });

    expect(errors).toEqual({ mail: "Ingresá un email válido." });
  });

  it("test_validacion_domicilio_activado_exige_campos_estructurales", () => {
    const errors = validateForm({
      ...INITIAL_FORM,
      nombre: "Ana",
      apellido: "Pérez",
      celular: "3415550000",
      mail: "ana@example.com",
      incluir_domicilio: true,
    });

    expect(errors.ciudad).toBeDefined();
    expect(errors.calle).toBeDefined();
    expect(errors.altura).toBeDefined();
    expect(errors.cp).toBeDefined();
  });

  it("test_payload_mail_en_minusculas_y_sin_check_de_usuario", () => {
    const payload = buildClientePayload({
      ...INITIAL_FORM,
      nombre: " Ana ",
      apellido: " Pérez ",
      celular: "341 555-0000",
      mail: " Ana.Perez@Example.com ",
    });

    expect(payload).toEqual({
      nombre: "Ana",
      apellido: "Pérez",
      celular: "3415550000",
      dni: null,
      sexo: null,
      fecha_nacimiento: null,
      mail: "ana.perez@example.com",
      domicilio: null,
    });
  });

  it("test_formulario_no_muestra_el_check_crear_usuario", () => {
    render(
      <MemoryRouter>
        <ClienteFormPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText("Crear usuario")).not.toBeInTheDocument();
  });

  it("test_submit_sin_mail_no_llama_a_la_api", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ClienteFormPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText(/^DNI/), "30111222");
    await user.type(screen.getByLabelText("Celular"), "3415550000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText(
        "El email es obligatorio: es el usuario del cliente para entrar al portal.",
      ),
    ).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("test_submit_sin_dni_pide_confirmacion_y_muestra_las_credenciales", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue({
      id: 1,
      nombre: "Ana",
      apellido: "Pérez",
      dni: null,
      username: "ana@example.com",
      password_temporal: "Ab12-cdEf3",
    });

    render(
      <MemoryRouter>
        <ClienteFormPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Celular"), "3415550000");
    await user.type(screen.getByLabelText("Email"), "Ana@Example.com");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Crear cliente sin DNI")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Crear sin DNI" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const [, requestInit] = apiFetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(requestInit.body)) as ClienteCreatePayload;
    expect(payload.dni).toBeNull();
    expect(payload.mail).toBe("ana@example.com");
    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Ab12-cdEf3")).toBeInTheDocument();
  });

  it("test_submit_mail_en_uso_muestra_el_error_en_el_campo", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockRejectedValue(
      Object.assign(new Error("Ya existe una cuenta con ese mail"), {
        status: 409,
        body: { error: "MAIL_EN_USO", detalle: "Ya existe una cuenta con ese mail" },
      }),
    );

    render(
      <MemoryRouter>
        <ClienteFormPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText(/^DNI/), "30111222");
    await user.type(screen.getByLabelText("Celular"), "3415550000");
    await user.type(screen.getByLabelText("Email"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findAllByText("Ya existe una cuenta con ese email.")).not.toHaveLength(0);
  });
});
