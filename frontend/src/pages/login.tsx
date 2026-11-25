import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { applyBrandingToDocument } from "@/lib/branding";
import type { CambiarContrasenaObligatorioResponse } from "@/types/auth";
import type { PublicConfig } from "@/types/config";

interface ApiError extends Error {
  status?: number;
  body?: {
    error?: string;
    detalle?: string;
  };
}

function getApiErrorCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null) {
    return null;
  }
  const body = (err as ApiError).body;
  if (typeof body?.error === "string") {
    return body.error;
  }
  return null;
}

/** Lo que deja la pantalla de registro al volver al login. */
export interface LoginLocationState {
  registrado?: string;
}

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const location = useLocation();
  const registrado = (location.state as LoginLocationState | null)?.registrado ?? null;
  const [username, setUsername] = useState(registrado ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    registrado ? "Tu cuenta quedó creada. Ingresá con tu mail y tu contraseña." : null
  );
  const [brand, setBrand] = useState<string | null>(null);

  const [changeUsername, setChangeUsername] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isChangeOpen = changeUsername !== null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await apiFetch<PublicConfig>("/api/config/public");
        if (!mounted) return;
        setBrand(applyBrandingToDocument(cfg));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function clearLoginForm() {
    setUsername("");
    setPassword("");
  }

  function resetChangeForm() {
    setCurrentPassword("");
    setNewPassword("");
    setRepeatPassword("");
    setChangeError(null);
    setMismatchError(null);
  }

  function closeChangeDialog() {
    if (isChanging) {
      return;
    }
    setChangeUsername(null);
    resetChangeForm();
    clearLoginForm();
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      if (code === "DEBE_CAMBIAR_CONTRASENA") {
        setChangeUsername(username.trim());
        resetChangeForm();
        return;
      }
      if (code === "CREDENCIALES_INVALIDAS" || code === "CLAVE_INCORRECTA") {
        setError("Credenciales incorrectas");
        clearLoginForm();
        return;
      }
      if (code === "USUARIO_DESHABILITADO") {
        setError("Usuario deshabilitado");
        clearLoginForm();
        return;
      }
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changeUsername) {
      return;
    }

    setChangeError(null);
    setMismatchError(null);

    if (!currentPassword || !newPassword || !repeatPassword) {
      setChangeError("Completá todos los campos.");
      return;
    }
    if (newPassword.length < 8) {
      setChangeError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== repeatPassword) {
      setMismatchError("Las contraseñas nuevas no coinciden");
      return;
    }

    setIsChanging(true);
    try {
      await apiFetch<CambiarContrasenaObligatorioResponse>(
        "/api/auth/cambiar-contrasena-obligatorio",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: changeUsername,
            password_actual: currentPassword,
            password_nueva: newPassword,
          }),
        }
      );
      setChangeUsername(null);
      resetChangeForm();
      clearLoginForm();
      setError(null);
      setSuccessMessage(
        "Contraseña actualizada correctamente. Por favor, inicia sesión con tus nuevas credenciales."
      );
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      if (code === "CREDENCIALES_INVALIDAS") {
        setChangeError("Credenciales incorrectas");
      } else if (code === "USUARIO_DESHABILITADO") {
        setChangeError("Usuario deshabilitado");
      } else {
        const message =
          err instanceof Error ? err.message : "No se pudo actualizar la contraseña.";
        setChangeError(message);
      }
    } finally {
      setIsChanging(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/login_background.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-md p-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-md">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[color:var(--primary)] font-bold text-[color:var(--primary-foreground)]">
              <img src="/icon.png" alt="Icono" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-xl font-semibold text-white">{brand || "SGV"}</div>
              <div className="text-sm text-white/80">Gestión Veterinaria</div>
            </div>
          </div>

          {successMessage ? (
            <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {successMessage}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {isSubmitting ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white shadow-sm"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Loader2 className="size-5 animate-spin text-[color:var(--primary)]" />
              </span>
              <div>
                <p className="font-medium">Iniciando sesión</p>
                <p className="text-xs text-white/65">Estamos verificando tus datos...</p>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm text-white/90">
                Usuario o mail
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/50"
                placeholder="usuario o mail"
                maxLength={100}
                autoComplete="username"
                disabled={isLoading || isSubmitting}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-white/90">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/50"
                placeholder="contraseña"
                autoComplete="current-password"
                disabled={isLoading || isSubmitting}
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || isSubmitting}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--primary)] px-4 py-2 font-medium text-white shadow-sm transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading || isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Ingresar"
                )}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-sm text-white/80">
            ¿Sos cliente y no tenés cuenta?{" "}
            <Link to="/registro" className="font-medium text-white underline-offset-4 hover:underline">
              Crear cuenta
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center text-sm text-white/60">
          © {new Date().getFullYear()} {brand || "SGV"}
        </div>
      </div>

      <Dialog
        open={isChangeOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeChangeDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambio de contraseña requerido</DialogTitle>
            <DialogDescription>
              Por razones de seguridad, debes actualizar tu contraseña antes de continuar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password_actual">Contraseña actual</Label>
              <Input
                id="password_actual"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isChanging}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password_nueva">Nueva contraseña</Label>
              <Input
                id="password_nueva"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isChanging}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password_repetir">Repetir contraseña</Label>
              <Input
                id="password_repetir"
                type="password"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isChanging}
              />
              {mismatchError ? (
                <p className="text-sm text-destructive">{mismatchError}</p>
              ) : null}
            </div>

            {changeError ? <p className="text-sm text-destructive">{changeError}</p> : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeChangeDialog}
                disabled={isChanging}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isChanging}>
                {isChanging ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Actualizar Contraseña"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
