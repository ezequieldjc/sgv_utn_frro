import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ParametrosPage, {
  groupConfigs,
  hasPermission,
  validateParametroValor,
} from "@/pages/admin/parametros-page";
import type { ConfigItem } from "@/types/config";

const { apiFetchMock, authState } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  authState: { permisos: ["parametros:ver", "parametros:editar"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: authState.permisos }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const ITEMS: ConfigItem[] = [
  {
    id: 1,
    config_id: 1,
    config_nombre: "JWT",
    parametro_id: 1,
    parametro_nombre: "ACCESS_TOKEN_EXPIRACION",
    parametro_valor: "15",
  },
  {
    id: 3,
    config_id: 2,
    config_nombre: "BRANDING",
    parametro_id: 1,
    parametro_nombre: "RAZON_SOCIAL",
    parametro_valor: "Yacanvet",
  },
  {
    id: 2,
    config_id: 1,
    config_nombre: "JWT",
    parametro_id: 2,
    parametro_nombre: "REFRESH_TOKEN_EXPIRACION",
    parametro_valor: "1440",
  },
];

describe("parámetros — helpers", () => {
  it("test_has_permission_acepta_wildcard_y_permiso_exacto", () => {
    expect(hasPermission(["*"], "parametros:ver")).toBe(true);
    expect(hasPermission(["parametros:ver"], "parametros:ver")).toBe(true);
    expect(hasPermission(["parametros:ver"], "parametros:editar")).toBe(false);
  });

  it("test_validate_parametro_valor_entero_y_texto", () => {
    expect(validateParametroValor("ACCESS_TOKEN_EXPIRACION", "30")).toBeNull();
    expect(validateParametroValor("ACCESS_TOKEN_EXPIRACION", "abc")).toBeTruthy();
    expect(validateParametroValor("ACCESS_TOKEN_EXPIRACION", "0")).toBeTruthy();
    expect(validateParametroValor("RAZON_SOCIAL", "   ")).toBeTruthy();
    expect(validateParametroValor("RAZON_SOCIAL", "Clinica")).toBeNull();
    expect(validateParametroValor("OTRO_PARAM", "x")).toBeNull();
  });

  it("test_group_configs_agrupa_por_config_nombre_y_ordena", () => {
    const groups = groupConfigs(ITEMS);
    expect(groups.map((g) => g.config_nombre)).toEqual(["BRANDING", "JWT"]);
    expect(groups[1].items.map((i) => i.parametro_nombre)).toEqual([
      "ACCESS_TOKEN_EXPIRACION",
      "REFRESH_TOKEN_EXPIRACION",
    ]);
  });
});

describe("parámetros — UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    authState.permisos = ["parametros:ver", "parametros:editar"];
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue(ITEMS);
  });

  it("test_sin_parametros_ver_muestra_acceso_denegado", () => {
    authState.permisos = ["usuarios:ver"];
    render(
      <MemoryRouter>
        <ParametrosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("test_sin_parametros_editar_no_muestra_guardar_e_inputs_readonly", async () => {
    authState.permisos = ["parametros:ver"];
    render(
      <MemoryRouter>
        <ParametrosPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText("RAZON_SOCIAL")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /guardar cambios/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("RAZON_SOCIAL")).toHaveAttribute("readonly");
  });

  it("test_con_editar_muestra_guardar_y_agrupa_secciones", async () => {
    render(
      <MemoryRouter>
        <ParametrosPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("JWT")).toBeInTheDocument());
    expect(screen.getByText("BRANDING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/config");
  });
});
