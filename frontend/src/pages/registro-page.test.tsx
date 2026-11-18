import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RegistroPage, {
  armarRegistroPayload,
  REGISTRO_VACIO,
  validarRegistro,
  type RegistroForm,
} from "@/pages/registro-page";

const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const COMPLETO: RegistroForm = {
  nombre: "Lucía",
  apellido: "Fernández",
  dni: "40111222",
  celular: "341 555-6677",
  mail: " Lucia@Example.com ",
  fecha_nacimiento: "1995-04-02",
  sexo: "F",
  password: "MiClave123",
  password_repetida: "MiClave123",
};

function LoginFalso() {
  const location = useLocation();
  return <p>login: {(location.state as { registrado?: string } | null)?.registrado}</p>;
}

function renderPagina() {
  return render(
    <MemoryRouter initialEntries={["/registro"]}>
      <Routes>
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/login" element={<LoginFalso />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function completar(user: ReturnType<typeof userEvent.setup>, repetida = "MiClave123") {
  await user.type(screen.getByLabelText("Nombre"), "Lucía");
  await user.type(screen.getByLabelText("Apellido"), "Fernández");
  await user.type(screen.getByLabelText("DNI"), "40111222");
  await user.type(screen.getByLabelText("Celular"), "3415556677");
  await user.type(screen.getByLabelText("Mail (va a ser tu usuario)"), "Lucia@Example.com");
  await user.type(screen.getByLabelText("Contraseña"), "MiClave123");
  await user.type(screen.getByLabelText("Repetir contraseña"), repetida);
}

describe("RegistroPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiFetchMock.mockReset();
    // La pantalla pide el nombre de la clínica al montarse.
    apiFetchMock.mockImplementation((url: string) =>
      url === "/api/config/public"
        ? Promise.resolve({ razon_social: "Yacanvet" })
        : Promise.reject(new Error("no mockeado")),
    );
  });

  it("test_validar_registro_vacio_exige_los_obligatorios", () => {
    const errores = validarRegistro(REGISTRO_VACIO);

    expect(Object.keys(errores).sort()).toEqual(
      ["apellido", "celular", "dni", "mail", "nombre", "password"].sort(),
    );
  });

  it("test_validar_registro_contrasenas_distintas_devuelve_error", () => {
    const errores = validarRegistro({ ...COMPLETO, password_repetida: "OtraClave123" });

    expect(errores).toEqual({ password_repetida: "Las contraseñas no coinciden." });
  });

  it("test_validar_registro_fecha_futura_devuelve_error", () => {
    const errores = validarRegistro({ ...COMPLETO, fecha_nacimiento: "2030-01-01" }, "2026-11-18");

    expect(errores).toEqual({
      fecha_nacimiento: "La fecha de nacimiento no puede ser futura.",
    });
  });

  it("test_payload_registro_mail_en_minusculas_y_celular_solo_digitos", () => {
    expect(armarRegistroPayload({ ...COMPLETO, sexo: "", fecha_nacimiento: "" })).toEqual({
      nombre: "Lucía",
      apellido: "Fernández",
      dni: "40111222",
      celular: "3415556677",
      mail: "lucia@example.com",
      fecha_nacimiento: null,
      sexo: null,
      password: "MiClave123",
      password_repetida: "MiClave123",
    });
  });

  it("test_registro_contrasenas_distintas_no_llama_a_la_api", async () => {
    const user = userEvent.setup();
    renderPagina();

    await completar(user, "OtraClave123");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/auth/registro", expect.anything());
  });

  it("test_registro_exitoso_vuelve_al_login_con_el_mail", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockImplementation((url: string) =>
      url === "/api/auth/registro"
        ? Promise.resolve({ mensaje: "ok", username: "lucia@example.com" })
        : Promise.resolve({ razon_social: "Yacanvet" }),
    );
    renderPagina();

    await completar(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("login: lucia@example.com")).toBeInTheDocument();
    const llamada = apiFetchMock.mock.calls.find(([url]) => url === "/api/auth/registro");
    const body = JSON.parse(String((llamada?.[1] as RequestInit).body));
    expect(body.mail).toBe("lucia@example.com");
    expect(body.password).toBe("MiClave123");
  });

  it("test_registro_cuenta_existente_muestra_el_mensaje_del_backend", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockImplementation((url: string) =>
      url === "/api/auth/registro"
        ? Promise.reject(
            Object.assign(new Error("409"), {
              status: 409,
              body: {
                error: "CUENTA_EXISTENTE",
                detalle: "Ya existe una cuenta con esos datos.",
              },
            }),
          )
        : Promise.resolve({ razon_social: "Yacanvet" }),
    );
    renderPagina();

    await completar(user);
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() =>
      expect(screen.getByText("Ya existe una cuenta con esos datos.")).toBeInTheDocument(),
    );
  });
});
