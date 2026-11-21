import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UsuarioFormPage, {
  buildUpdatePayload,
  formFromDetail,
  validateClienteForm,
} from "@/pages/admin/usuario-form-page";
import type { UsuarioDetail } from "@/types/usuarios";

const { apiFetchMock, permisosMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  permisosMock: { value: ["usuarios:ver", "usuarios:editar"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: permisosMock.value }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const EMPLEADO: UsuarioDetail = {
  id: 7,
  username: "vsosa",
  habilitado: true,
  rol_id: 2,
  rol_nombre: "VETERINARIO",
  es_cliente: false,
  nombre: "Valeria",
  apellido: "Sosa",
  dni: "27111222",
  fecha_nacimiento: "1990-05-10",
  sexo: "F",
  celular: "3415551234",
  mail: null,
  domicilio: {
    pais: "Argentina",
    provincia: "Santa Fe",
    ciudad: "Rosario",
    calle: "San Martín",
    altura: "100",
    cp: "2000",
    departamento: null,
    notas: null,
  },
  ultimo_inicio_sesion: null,
};

const CLIENTE: UsuarioDetail = {
  ...EMPLEADO,
  id: 8,
  username: "ana@example.com",
  rol_id: 5,
  rol_nombre: "CLIENTE",
  es_cliente: true,
  dni: null,
  fecha_nacimiento: null,
  sexo: null,
  mail: "ana@example.com",
  domicilio: null,
};

function mockApi(detalle: UsuarioDetail) {
  apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url === "/api/roles") {
      return Promise.resolve([
        { id: 2, nombre: "VETERINARIO" },
        { id: 5, nombre: "CLIENTE" },
      ]);
    }
    if (url === `/api/usuarios/${detalle.id}` && init?.method === "PUT") {
      return Promise.resolve(detalle);
    }
    if (url === `/api/usuarios/${detalle.id}`) {
      return Promise.resolve(detalle);
    }
    return Promise.reject(new Error(`no mockeado: ${url}`));
  });
}

function renderEn(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/usuarios/:id" element={<UsuarioFormPage key="view" mode="view" />} />
        <Route
          path="/admin/usuarios/:id/editar"
          element={<UsuarioFormPage key="edit" mode="edit" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UsuarioFormPage: ver detalle y editar", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    permisosMock.value = ["usuarios:ver", "usuarios:editar"];
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("test_form_from_detail_convierte_la_fecha_y_el_domicilio", () => {
    const form = formFromDetail(EMPLEADO);

    expect(form.fecha_nacimiento).toBe("10/05/1990");
    expect(form.ciudad).toBe("Rosario");
    expect(form.rol_id).toBe("2");
  });

  it("test_validar_usuario_cliente_exige_mail_y_no_domicilio", () => {
    const form = formFromDetail(CLIENTE);

    expect(validateClienteForm(form)).toEqual({});
    expect(validateClienteForm({ ...form, mail: "" }).mail).toBeDefined();
  });

  it("test_payload_usuario_cliente_sin_domicilio_manda_null", () => {
    const payload = buildUpdatePayload(formFromDetail(CLIENTE), true);

    expect(payload.domicilio).toBeNull();
    expect(payload.dni).toBeNull();
    expect(payload.mail).toBe("ana@example.com");
  });

  it("test_ver_detalle_muestra_los_datos_en_solo_lectura_y_el_boton_editar", async () => {
    mockApi(EMPLEADO);
    renderEn("/admin/usuarios/7");

    const nombre = await screen.findByLabelText("Nombre");
    expect(nombre).toHaveValue("Valeria");
    expect(nombre).toBeDisabled();
    expect(screen.getByText("Detalle de usuario")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Editar/ })).toHaveAttribute(
      "href",
      "/admin/usuarios/7/editar",
    );
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
  });

  it("test_ver_detalle_sin_usuarios_editar_no_muestra_editar", async () => {
    permisosMock.value = ["usuarios:ver"];
    mockApi(EMPLEADO);
    renderEn("/admin/usuarios/7");

    await screen.findByLabelText("Nombre");
    expect(screen.queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();
  });

  it("test_editar_usuario_guarda_con_put_y_vuelve_al_detalle", async () => {
    const user = userEvent.setup();
    mockApi(EMPLEADO);
    renderEn("/admin/usuarios/7/editar");

    const nombre = await screen.findByLabelText("Nombre");
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled());
    await user.clear(nombre);
    await user.type(nombre, "Valeria Inés");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByText("Detalle de usuario")).toBeInTheDocument());
    const put = apiFetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
    );
    expect(put?.[0]).toBe("/api/usuarios/7");
    const body = JSON.parse(String((put?.[1] as RequestInit).body));
    expect(body.nombre).toBe("Valeria Inés");
    expect(body.rol_id).toBe(2);
    expect(body.domicilio.ciudad).toBe("Rosario");
  });

  it("test_editar_usuario_cliente_no_permite_cambiar_el_rol", async () => {
    mockApi(CLIENTE);
    renderEn("/admin/usuarios/8/editar");

    await screen.findByLabelText("Nombre");
    expect(screen.getByLabelText("Rol")).toBeDisabled();
  });
});
