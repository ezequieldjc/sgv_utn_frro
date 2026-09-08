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
import ClientesPage from "./pages/clientes/clientes-page";
import ClienteFormPage from "./pages/clientes/cliente-form-page";
import {
  ClienteDetallePage,
  ClienteEditarPage,
  MascotasStubPage,
} from "./pages/clientes/stubs";

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
            <Route path="admin/catalogos" element={<CatalogosPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="clientes/nuevo" element={<ClienteFormPage />} />
            <Route path="clientes/:id" element={<ClienteDetallePage />} />
            <Route path="clientes/:id/editar" element={<ClienteEditarPage />} />
            <Route path="mascotas" element={<MascotasStubPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
