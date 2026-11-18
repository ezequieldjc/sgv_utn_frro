import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { apiFetch } from "@/lib/api";
import type { RegistroPayload, RegistroResponse } from "@/types/auth";
import type { PublicConfig } from "@/types/config";

import type { LoginLocationState } from "./login";

export interface RegistroForm {
  nombre: string;
  apellido: string;
  dni: string;
  celular: string;
  mail: string;
  fecha_nacimiento: string;
  sexo: "" | "M" | "F" | "X";
  password: string;
  password_repetida: string;
}

export type RegistroErrores = Partial<Record<keyof RegistroForm, string>>;

export const REGISTRO_VACIO: RegistroForm = {
  nombre: "",
  apellido: "",
  dni: "",
  celular: "",
  mail: "",
  fecha_nacimiento: "",
  sexo: "",
  password: "",
  password_repetida: "",
};

const MAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hoyIso(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

export function validarRegistro(form: RegistroForm, hoy: string = hoyIso()): RegistroErrores {
  const errores: RegistroErrores = {};
  if (!form.nombre.trim()) errores.nombre = "El nombre es obligatorio.";
  if (!form.apellido.trim()) errores.apellido = "El apellido es obligatorio.";
  if (!form.dni.trim()) {
    errores.dni = "El DNI es obligatorio.";
  } else if (!/^\d+$/.test(form.dni.trim())) {
    errores.dni = "El DNI debe contener solo números.";
  }
  if (!form.celular.replace(/\D/g, "")) errores.celular = "El celular es obligatorio.";
  if (!form.mail.trim()) {
    errores.mail = "El mail es obligatorio: es tu usuario para ingresar.";
  } else if (!MAIL_VALIDO.test(form.mail.trim())) {
    errores.mail = "Ingresá un mail válido.";
  }
  if (form.fecha_nacimiento && form.fecha_nacimiento > hoy) {
    errores.fecha_nacimiento = "La fecha de nacimiento no puede ser futura.";
  }
  if (form.password.length < 8) {
    errores.password = "La contraseña debe tener al menos 8 caracteres.";
  }
  if (form.password_repetida !== form.password) {
    errores.password_repetida = "Las contraseñas no coinciden.";
  }
  return errores;
}

export function armarRegistroPayload(form: RegistroForm): RegistroPayload {
  return {
    nombre: form.nombre.trim(),
    apellido: form.apellido.trim(),
    dni: form.dni.trim(),
    celular: form.celular.replace(/\D/g, ""),
    mail: form.mail.trim().toLowerCase(),
    fecha_nacimiento: form.fecha_nacimiento || null,
    sexo: form.sexo || null,
    password: form.password,
    password_repetida: form.password_repetida,
  };
}

// Misma altura para inputs, fechas y selects, así las columnas quedan alineadas.
const inputClass =
  "mt-1.5 block h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-base text-white placeholder:text-white/50 focus:border-white/50 focus:outline-none [color-scheme:dark]";

function Campo({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="block whitespace-nowrap text-sm font-medium text-white">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export default function RegistroPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegistroForm>(REGISTRO_VACIO);
  const [errores, setErrores] = useState<RegistroErrores>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [brand, setBrand] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    apiFetch<PublicConfig>("/api/config/public")
      .then((cfg) => {
        if (mounted) setBrand(cfg.razon_social || cfg.clinic_name || null);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  function actualizar<K extends keyof RegistroForm>(campo: K, valor: RegistroForm[K]) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function registrar(event: React.FormEvent) {
    event.preventDefault();
    if (enviando) return;
    const nuevosErrores = validarRegistro(form);
    setErrores(nuevosErrores);
    setError(null);
    if (Object.keys(nuevosErrores).length > 0) return;

    setEnviando(true);
    try {
      const res = await apiFetch<RegistroResponse>("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(armarRegistroPayload(form)),
      });
      const state: LoginLocationState = { registrado: res.username };
      navigate("/login", { state });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const detalle = (err as { body?: { detalle?: unknown } }).body?.detalle;
      if (status === 409 && typeof detalle === "string") {
        setError(detalle);
      } else {
        setError("No pudimos crear tu cuenta. Revisá los datos y probá de nuevo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-fixed bg-center"
      style={{ backgroundImage: "url('/login_background.jpg')" }}
    >
      <div className="fixed inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-2xl px-4 py-8 sm:px-8">
        <div className="rounded-2xl border border-white/15 bg-neutral-900/55 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[color:var(--primary)] font-bold text-[color:var(--primary-foreground)]">
              <img src="/icon.png" alt="Icono" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-white">Crear cuenta</div>
              <div className="text-sm text-white/80">
                Portal de clientes de {brand || "la clínica"}
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form onSubmit={(e) => void registrar(e)} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Campo id="nombre" label="Nombre" error={errores.nombre}>
                <input
                  id="nombre"
                  className={inputClass}
                  value={form.nombre}
                  maxLength={100}
                  autoComplete="given-name"
                  onChange={(e) => actualizar("nombre", e.target.value)}
                />
              </Campo>
              <Campo id="apellido" label="Apellido" error={errores.apellido}>
                <input
                  id="apellido"
                  className={inputClass}
                  value={form.apellido}
                  maxLength={100}
                  autoComplete="family-name"
                  onChange={(e) => actualizar("apellido", e.target.value)}
                />
              </Campo>
              <Campo id="dni" label="DNI" error={errores.dni}>
                <input
                  id="dni"
                  className={inputClass}
                  value={form.dni}
                  inputMode="numeric"
                  maxLength={20}
                  onChange={(e) => actualizar("dni", e.target.value.replace(/\D/g, ""))}
                />
              </Campo>
              <Campo id="celular" label="Celular" error={errores.celular}>
                <input
                  id="celular"
                  className={inputClass}
                  value={form.celular}
                  inputMode="tel"
                  maxLength={30}
                  autoComplete="tel"
                  onChange={(e) => actualizar("celular", e.target.value.replace(/[^\d\s-]/g, ""))}
                />
              </Campo>
            </div>

            <Campo id="mail" label="Mail (va a ser tu usuario)" error={errores.mail}>
              <input
                id="mail"
                type="email"
                className={inputClass}
                value={form.mail}
                maxLength={100}
                autoComplete="email"
                onChange={(e) => actualizar("mail", e.target.value)}
              />
            </Campo>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo
                id="fecha_nacimiento"
                label="Fecha de nacimiento (opcional)"
                error={errores.fecha_nacimiento}
              >
                <input
                  id="fecha_nacimiento"
                  type="date"
                  className={inputClass}
                  value={form.fecha_nacimiento}
                  max={hoyIso()}
                  onChange={(e) => actualizar("fecha_nacimiento", e.target.value)}
                />
              </Campo>
              <Campo id="sexo" label="Sexo (opcional)">
                <select
                  id="sexo"
                  className={inputClass}
                  value={form.sexo}
                  onChange={(e) => actualizar("sexo", e.target.value as RegistroForm["sexo"])}
                >
                  <option value="" className="text-black">
                    Prefiero no decirlo
                  </option>
                  <option value="F" className="text-black">
                    Femenino
                  </option>
                  <option value="M" className="text-black">
                    Masculino
                  </option>
                  <option value="X" className="text-black">
                    X
                  </option>
                </select>
              </Campo>
              <Campo id="password" label="Contraseña" error={errores.password}>
                <input
                  id="password"
                  type="password"
                  className={inputClass}
                  value={form.password}
                  maxLength={128}
                  autoComplete="new-password"
                  onChange={(e) => actualizar("password", e.target.value)}
                />
              </Campo>
              <Campo
                id="password_repetida"
                label="Repetir contraseña"
                error={errores.password_repetida}
              >
                <input
                  id="password_repetida"
                  type="password"
                  className={inputClass}
                  value={form.password_repetida}
                  maxLength={128}
                  autoComplete="new-password"
                  onChange={(e) => actualizar("password_repetida", e.target.value)}
                />
              </Campo>
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--primary)] px-4 text-base font-medium text-white disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                "Crear cuenta"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-white/80">
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="font-medium text-white underline-offset-4 hover:underline">
              Ingresar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
