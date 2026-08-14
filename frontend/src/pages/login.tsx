import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/auth-context';
import { apiFetch } from '../lib/api';
import type { PublicConfig } from '../types/config';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await apiFetch<PublicConfig>('/api/config/public');
        if (!mounted) return;
        setBrand(cfg.razon_social || cfg.clinic_name || null);
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      const code = err?.body?.code || err?.body?.detalle || err?.message;
      // translate backend error codes
      if (code === 'CREDENCIALES_INVALIDAS' || code === 'CLAVE_INCORRECTA') {
        setError('Credenciales incorrectas');
        setUsername('');
        setPassword('');
      } else if (code === 'USUARIO_DESHABILITADO') {
        setError('Usuario deshabilitado');
        setUsername('');
        setPassword('');
      } else {
        setError(typeof code === 'string' ? code : 'Error al iniciar sesión');
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: "url('/login_background.jpg')" }}>
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-[color:var(--primary)] flex items-center justify-center text-[color:var(--primary-foreground)] font-bold overflow-hidden">
              <img src="/icon.png" alt="Icono" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-xl font-semibold text-white">{brand || 'SGV'}</div>
              <div className="text-sm text-white/80">Gestión Veterinaria</div>
            </div>
          </div>

          {error && <div className="mb-4 text-sm text-red-300">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-white/90">Usuario</label>
              <input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/50"
                placeholder="usuario"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-white/90">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-white placeholder:text-white/50"
                placeholder="contraseña"
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center rounded-md bg-[color:var(--primary)] px-4 py-2 text-white disabled:opacity-60"
              >
                {isLoading ? 'Cargando...' : 'Ingresar'}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-white/60">
          © {new Date().getFullYear()} {brand || 'SGV'}
        </div>
      </div>
    </div>
  );
}
