import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RolesPage, {
  filterPermisosCatalogo,
  groupPermisos,
  hasPermission,
  isAdminRoleName,
} from "@/pages/admin/roles-page";
import type { PermisoItem, RolDetail, RolListItem } from "@/types/roles";

const { apiFetchMock, authState } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  authState: { permisos: ["roles:ver", "roles:crear", "roles:editar"] as string[] },
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ permisos: authState.permisos }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const ROLES: RolListItem[] = [
  { id: 1, nombre: "ADMIN" },
  { id: 2, nombre: "CLIENTE" },
];

const CATALOGO: PermisoItem[] = [
  { id: 99, nombre: "*", descripcion: "Acceso total" },
  { id: 10, nombre: "mascotas:ver_listado", descripcion: "Ver mascotas" },
  { id: 11, nombre: "mascotas:crear", descripcion: "Crear mascota" },
  { id: 20, nombre: "clientes:ver_listado", descripcion: "Ver clientes" },
];

const DETALLE_CLIENTE: RolDetail = {
  id: 2,
  nombre: "CLIENTE",
  descripcion: "Portal",
  es_admin: false,
  acceso_total: false,
  permisos: [CATALOGO[1]],
};

const DETALLE_ADMIN: RolDetail = {
  id: 1,
  nombre: "ADMIN",
  descripcion: "Sistema",
  es_admin: true,
  acceso_total: true,
  permisos: [CATALOGO[0]],
};

function mockApiForRoles() {
  apiFetchMock.mockImplementation(async (url: unknown) => {
    const path = String(url);
    if (path === "/api/roles") {
      return ROLES;
    }
    if (path === "/api/permisos") {
      return CATALOGO;
    }
    if (path === "/api/roles/1") {
      return DETALLE_ADMIN;
    }
    if (path === "/api/roles/2") {
      return DETALLE_CLIENTE;
    }
    throw new Error(`Unexpected url: ${path}`);
  });
}

function renderRoles(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/roles" element={<RolesPage />} />
        <Route path="/admin/roles/:id" element={<RolesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("roles y permisos — helpers", () => {
  it("test_has_permission_acepta_wildcard_y_permiso_exacto", () => {
    expect(hasPermission(["*"], "roles:ver")).toBe(true);
    expect(hasPermission(["roles:ver"], "roles:ver")).toBe(true);
    expect(hasPermission(["roles:ver"], "roles:crear")).toBe(false);
  });

  it("test_is_admin_role_name_es_case_insensitive", () => {
    expect(isAdminRoleName("ADMIN")).toBe(true);
    expect(isAdminRoleName("admin")).toBe(true);
    expect(isAdminRoleName("CLIENTE")).toBe(false);
  });

  it("test_group_permisos_agrupa_por_dominio_y_ordena", () => {
    const groups = groupPermisos(CATALOGO.filter((p) => p.nombre !== "*"));
    expect(groups.map((g) => g.dominio)).toEqual(["clientes", "mascotas"]);
    expect(groups[1].permisos.map((p) => p.nombre)).toEqual([
      "mascotas:crear",
      "mascotas:ver_listado",
    ]);
  });

  it("test_filter_permisos_excluye_comodin_en_roles_editables", () => {
    const filtered = filterPermisosCatalogo(CATALOGO, "", true);
    expect(filtered.every((p) => p.nombre !== "*")).toBe(true);
    expect(filterPermisosCatalogo(CATALOGO, "cliente", true).map((p) => p.nombre)).toEqual([
      "clientes:ver_listado",
    ]);
  });
});

describe("roles y permisos — UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    authState.permisos = ["roles:ver", "roles:crear", "roles:editar"];
    apiFetchMock.mockReset();
    mockApiForRoles();
  });

  it("test_sin_roles_ver_muestra_acceso_denegado", () => {
    authState.permisos = ["usuarios:ver"];
    renderRoles("/admin/roles/2");
    expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("test_sin_roles_crear_no_muestra_boton_nuevo_rol", async () => {
    authState.permisos = ["roles:ver", "roles:editar"];
    renderRoles("/admin/roles/2");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "CLIENTE" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /nuevo rol/i })).not.toBeInTheDocument();
  });

  it("test_rol_admin_matriz_solo_lectura_sin_guardar", async () => {
    renderRoles("/admin/roles/1");
    expect(await screen.findByRole("heading", { name: "ADMIN" })).toBeInTheDocument();
    expect(screen.getAllByText("Solo lectura", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Acceso total", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeDisabled();
      expect(checkbox).toBeChecked();
    }
  });

  it("test_deep_link_id_selecciona_el_rol", async () => {
    renderRoles("/admin/roles/2");
    await waitFor(() => expect(screen.getByText("Portal")).toBeInTheDocument());
    expect(apiFetchMock).toHaveBeenCalledWith("/api/roles/2");
    expect(screen.getAllByRole("button", { name: /nuevo rol/i }).length).toBe(1);
  });
});
