import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/auth-context";
import { ProtectedRoute } from "./components/protected-route";
import { AppShell } from "./components/app-shell";
import LoginPage from "./pages/login";
import ShellHome from "./pages/shell-home";
import UsuariosPage from "./pages/admin/usuarios-page";
import UsuarioFormPage from "./pages/admin/usuario-form-page";
import CatalogosPage from "./pages/admin/catalogos-page";
import RolesPage from "./pages/admin/roles-page";
import ParametrosPage from "./pages/admin/parametros-page";
import ClientesPage from "./pages/clientes/clientes-page";
import ClienteFormPage from "./pages/clientes/cliente-form-page";
import {
  ClienteDetallePage,
  ClienteEditarPage,
} from "./pages/clientes/stubs";
import MascotasPage from "./pages/mascotas/mascotas-page";
import MascotaFormPage from "./pages/mascotas/mascota-form-page";
import MascotaEditPage from "./pages/mascotas/mascota-edit-page";
import ConsultasHistorialPage from "./pages/consultas/consultas-historial-page";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<ShellHome />} />
            <Route path="admin/usuarios" element={<UsuariosPage />} />
            <Route path="admin/usuarios/nuevo" element={<UsuarioFormPage mode="create" />} />
            <Route path="admin/roles" element={<RolesPage />} />
            <Route path="admin/roles/:id" element={<RolesPage />} />
            <Route path="admin/parametros" element={<ParametrosPage />} />
            <Route path="admin/catalogos" element={<CatalogosPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="clientes/nuevo" element={<ClienteFormPage />} />
            <Route path="clientes/:id" element={<ClienteDetallePage />} />
            <Route path="clientes/:id/editar" element={<ClienteEditarPage />} />
            <Route path="mascotas" element={<MascotasPage />} />
            <Route path="mascotas/nuevo" element={<MascotaFormPage />} />
            <Route path="mascotas/:id/editar" element={<MascotaEditPage />} />
            <Route path="consultas/historial" element={<ConsultasHistorialPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
