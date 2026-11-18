import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ClienteFormPage, {
  buildClientePayload,
  buildClienteUpdatePayload,
  formFromCliente,
  INITIAL_FORM,
  validateForm,
} from "@/pages/clientes/cliente-form-page";
import type { ClienteCreatePayload, ClienteDetail } from "@/types/clientes";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

const { permisosMock } = vi.hoisted(() => ({
  permisosMock: { value: ["clientes:crear"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: permisosMock.value }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

beforeEach(() => {
  apiFetchMock.mockReset();
  permisosMock.value = ["clientes:crear"];
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

const CLIENTE: ClienteDetail = {
  id: 4,
  nombre: "Ana",
  apellido: "Pérez",
  dni: "30111222",
  sexo: "F",
  fecha_nacimiento: "1990-03-15",
  celular: "3415550000",
  mail: "ana@example.com",
  fecha_alta: "2026-11-17T12:00:00Z",
  domicilio: {
    pais: "Argentina",
    provincia: "Santa Fe",
    ciudad: "Rosario",
    calle: "Córdoba",
    altura: "1200",
    cp: "2000",
    departamento: null,
    notas: null,
  },
  cuenta: { usuario_id: 9, username: "ana@example.com", habilitado: true },
};

function renderCliente(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clientes/:id" element={<ClienteFormPage key="view" mode="view" />} />
        <Route path="/clientes/:id/editar" element={<ClienteFormPage key="edit" mode="edit" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ver detalle y editar clientes", () => {
  beforeEach(() => {
    permisosMock.value = ["clientes:ver_listado", "clientes:editar"];
    apiFetchMock.mockImplementation((url: string) =>
      url === "/api/clientes/4" ? Promise.resolve(CLIENTE) : Promise.reject(new Error(url)),
    );
  });

  it("test_form_from_cliente_carga_fecha_y_domicilio", () => {
    const form = formFromCliente(CLIENTE);

    expect(form.fecha_nacimiento).toBe("15/03/1990");
    expect(form.incluir_domicilio).toBe(true);
    expect(form.ciudad).toBe("Rosario");
  });

  it("test_cliente_sin_cuenta_puede_quedar_sin_mail", () => {
    const form = { ...formFromCliente({ ...CLIENTE, cuenta: null }), mail: "" };

    expect(validateForm(form, false)).toEqual({});
    expect(buildClienteUpdatePayload(form).mail).toBeNull();
  });

  it("test_detalle_cliente_en_solo_lectura_con_cuenta_y_boton_editar", async () => {
    renderCliente("/clientes/4");

    const nombre = await screen.findByLabelText("Nombre");
    expect(nombre).toHaveValue("Ana");
    expect(nombre).toBeDisabled();
    expect(screen.getByText("Detalle de Cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Usuario")).toHaveValue("ana@example.com");
    expect(screen.getByRole("link", { name: /Editar/ })).toHaveAttribute(
      "href",
      "/clientes/4/editar",
    );
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("test_editar_sin_permiso_clientes_editar_queda_en_solo_lectura", async () => {
    permisosMock.value = ["clientes:ver_listado"];
    renderCliente("/clientes/4/editar");

    expect(await screen.findByLabelText("Nombre")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("test_editar_cliente_guarda_con_put_y_vuelve_al_detalle", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockImplementation((url: string, init?: RequestInit) =>
      url === "/api/clientes/4"
        ? Promise.resolve(init?.method === "PUT" ? { ...CLIENTE, apellido: "Pérez Paz" } : CLIENTE)
        : Promise.reject(new Error(url)),
    );
    renderCliente("/clientes/4/editar");

    const apellido = await screen.findByLabelText("Apellido");
    await user.clear(apellido);
    await user.type(apellido, "Pérez Paz");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByText("Detalle de Cliente")).toBeInTheDocument());
    const put = apiFetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );
    const body = JSON.parse(String((put?.[1] as RequestInit).body));
    expect(body.apellido).toBe("Pérez Paz");
    expect(body.mail).toBe("ana@example.com");
    expect(body.domicilio.ciudad).toBe("Rosario");
  });
});

