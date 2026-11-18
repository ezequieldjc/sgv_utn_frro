import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { agruparEspecies } from "@/lib/mascotas";
import {
  hoyIso,
  PERMISO_CREAR_MASCOTA,
  validarNuevaMascota,
  type NuevaMascotaErrores,
  type NuevaMascotaForm,
} from "@/lib/portal";
import type { PortalMascota, PortalMascotaCreate, PortalOpcion, PortalRaza } from "@/types/portal";

import { AccessDenied, selectClass } from "../stock/shared";
import { Cargando, EncabezadoPortal, ErrorPortal, usePortal } from "./portal-componentes";

const FORM_VACIO: NuevaMascotaForm = {
  nombre: "",
  especie_id: "",
  raza_id: "",
  sexo: "",
  fecha_nacimiento: "",
};

function mensajeAlGuardar(error: unknown): string {
  const status = (error as { status?: number })?.status;
  const detalle = (error as { body?: { detalle?: unknown } })?.body?.detalle;
  if (status === 400 && typeof detalle === "string") {
    return detalle;
  }
  if (status === 403) {
    return "Tu usuario no puede dar de alta mascotas desde el portal.";
  }
  return "No pudimos guardar a tu mascota. Probá de nuevo en unos minutos.";
}

export default function NuevaMascotaPage() {
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const puedeCrear = permisos.includes("*") || permisos.includes(PERMISO_CREAR_MASCOTA);

  const especies = usePortal<PortalOpcion[]>(
    puedeCrear ? "/api/portal/mascotas/especies" : null,
    "las especies",
  );
  const [razas, setRazas] = React.useState<PortalRaza[]>([]);
  const [cargandoRazas, setCargandoRazas] = React.useState(false);
  const [form, setForm] = React.useState<NuevaMascotaForm>(FORM_VACIO);
  const [errores, setErrores] = React.useState<NuevaMascotaErrores>({});
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  const agrupadas = agruparEspecies(especies.data ?? []);

  React.useEffect(() => {
    if (!form.especie_id) {
      setRazas([]);
      return;
    }
    let cancelado = false;
    setCargandoRazas(true);
    void apiFetch<PortalRaza[]>(`/api/portal/mascotas/razas?especie_id=${form.especie_id}`)
      .then((res) => {
        if (!cancelado) {
          setRazas(res);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setRazas([]);
          setError("No pudimos cargar las razas. Probá de nuevo en unos minutos.");
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCargandoRazas(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [form.especie_id]);

  function actualizar<K extends keyof NuevaMascotaForm>(campo: K, valor: NuevaMascotaForm[K]) {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
      // Al cambiar de especie, la raza elegida deja de valer.
      ...(campo === "especie_id" ? { raza_id: "" } : {}),
    }));
    setErrores((prev) => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (enviando) {
      return;
    }
    const nuevosErrores = validarNuevaMascota(form);
    setErrores(nuevosErrores);
    setError(null);
    if (Object.keys(nuevosErrores).length > 0) {
      return;
    }
    const payload: PortalMascotaCreate = {
      nombre: form.nombre.trim(),
      especie_id: Number(form.especie_id),
      raza_id: Number(form.raza_id),
      sexo: form.sexo || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
    };
    setEnviando(true);
    try {
      const creada = await apiFetch<PortalMascota>("/api/portal/mascotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      navigate(`/portal/mascotas/${creada.id}`);
    } catch (err: unknown) {
      setError(mensajeAlGuardar(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!puedeCrear) {
    return (
      <AccessDenied
        mensaje="Tu usuario no puede dar de alta mascotas desde el portal."
        volverA="/portal/mascotas"
        volverLabel="Volver a mis mascotas"
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <EncabezadoPortal
        titulo="Agregar mascota"
        subtitulo="El peso, el microchip y los demás datos clínicos los completa la clínica."
        volverA="/portal/mascotas"
        volverLabel="Mis mascotas"
      />

      {especies.cargando ? <Cargando /> : null}
      {especies.error ? <ErrorPortal mensaje={especies.error} /> : null}

      {especies.data ? (
        <form
          onSubmit={(event) => void guardar(event)}
          className="space-y-4 rounded-2xl border bg-card p-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={form.nombre}
              maxLength={50}
              onChange={(e) => actualizar("nombre", e.target.value)}
            />
            {errores.nombre ? <p className="text-xs text-destructive">{errores.nombre}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="especie">Especie</Label>
            <select
              id="especie"
              value={form.especie_id}
              onChange={(e) => actualizar("especie_id", e.target.value)}
              className={selectClass}
            >
              <option value="">Elegí…</option>
              {agrupadas.destacadas.length > 0 ? (
                <optgroup label="Más comunes">
                  {agrupadas.destacadas.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {agrupadas.resto.length > 0 ? (
                <optgroup label={agrupadas.destacadas.length > 0 ? "Otras especies" : "Especies"}>
                  {agrupadas.resto.map((e) => (
                    <option key={e.id} value={String(e.id)}>
                      {e.nombre}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {errores.especie_id ? (
              <p className="text-xs text-destructive">{errores.especie_id}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="raza">Raza</Label>
            <select
              id="raza"
              value={form.raza_id}
              onChange={(e) => actualizar("raza_id", e.target.value)}
              disabled={!form.especie_id || cargandoRazas}
              className={selectClass}
            >
              <option value="">
                {!form.especie_id
                  ? "Primero elegí la especie"
                  : cargandoRazas
                    ? "Cargando razas…"
                    : "Elegí…"}
              </option>
              {razas.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.nombre}
                </option>
              ))}
            </select>
            {errores.raza_id ? <p className="text-xs text-destructive">{errores.raza_id}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo (opcional)</Label>
              <select
                id="sexo"
                value={form.sexo}
                onChange={(e) => actualizar("sexo", e.target.value as NuevaMascotaForm["sexo"])}
                className={selectClass}
              >
                <option value="">Sin indicar</option>
                <option value="M">Macho</option>
                <option value="H">Hembra</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_nacimiento">Fecha de nacimiento (opcional)</Label>
              <Input
                id="fecha_nacimiento"
                type="date"
                max={hoyIso()}
                value={form.fecha_nacimiento}
                onChange={(e) => actualizar("fecha_nacimiento", e.target.value)}
              />
              {errores.fecha_nacimiento ? (
                <p className="text-xs text-destructive">{errores.fecha_nacimiento}</p>
              ) : null}
            </div>
          </div>

          {error ? <ErrorPortal mensaje={error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/portal/mascotas">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
