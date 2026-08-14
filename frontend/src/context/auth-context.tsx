import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { AuthSessionResponse, Usuario } from '../types/auth';
import type { PublicConfig } from '../types/config';
import { useNavigate } from 'react-router-dom';

interface AuthContextValue {
  usuario: Usuario | null;
  permisos: string[];
  clinicName?: string;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [permisos, setPermisos] = useState<string[]>([]);
  const [clinicName, setClinicName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // rehydrate: call /api/auth/me and /api/config/public in parallel
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const [me, cfg] = await Promise.all([
          apiFetch<AuthSessionResponse>('/api/auth/me'),
          apiFetch<PublicConfig>('/api/config/public'),
        ]);
        if (!mounted) return;
        setUsuario(me.usuario);
        setPermisos(me.permisos || []);
        setClinicName(cfg.razon_social || cfg.clinic_name);
      } catch (err) {
        // not authenticated or config failed -> leave null
        setUsuario(null);
        setPermisos([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function login(username: string, password: string) {
    const payload = { username, password };
    const res = await apiFetch<AuthSessionResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setUsuario(res.usuario);
    setPermisos(res.permisos || []);
    // refresh public config
    try {
      const cfg = await apiFetch<PublicConfig>('/api/config/public');
      setClinicName(cfg.razon_social || cfg.clinic_name);
    } catch (e) {
      // ignore
    }
    navigate('/');
  }

  async function logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setUsuario(null);
    setPermisos([]);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ usuario, permisos, clinicName, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
