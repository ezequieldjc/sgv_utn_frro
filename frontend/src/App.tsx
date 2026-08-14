import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/auth-context';
import { ProtectedRoute } from './components/protected-route';
import { AppShell } from './components/app-shell';
import LoginPage from './pages/login';
import ShellHome from './pages/shell-home';
import UsuariosPage from './pages/admin/usuarios-page';

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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
