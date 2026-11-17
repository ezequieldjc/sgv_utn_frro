import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CalendarPlus, Loader2, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import {
  CANAL_LABEL,
  fechaIso,
  hasPermission,
  horaLabel,
  inicioPreseleccionado,
  mensajeError,
} from "@/lib/agenda";
import type {
  CanalOrigenInterno,
  DisponibilidadResponse,
  FranjaDisponible,
  MascotaAgendaOpcion,
  TipoTurnoOpcion,
  TurnoCreatePayload,
  TurnoItem,
  VeterinarioOpcion,
} from "@/types/agenda";
import { FranjasGrid } from "./franjas-grid";

export interface TurnoFormState {
  mascota_id: string;
  mascota_label: string;
  mascota_search: string;
  tipo_turno_id: string;
  veterinario_id: string;
  fecha: string;
  /** ISO del inicio elegido en la grilla de franjas libres. */
  fecha_hora_inicio: string;
  canal_origen: CanalOrigenInterno;
  confirmado: boolean;
}

export type TurnoFormErrors = Partial<Record<keyof TurnoFormState, string>>;

export const INITIAL_TURNO_FORM: TurnoFormState = {
  mascota_id: "",
  mascota_label: "",
  mascota_search: "",
  tipo_turno_id: "",
  veterinario_id: "",
  fecha: "",
  fecha_hora_inicio: "",
  canal_origen: "mostrador",
  confirmado: false,
};

const CANALES_INTERNOS: CanalOrigenInterno[] = ["mostrador", "telefono", "whatsapp"];

export function validateTurnoForm(form: TurnoFormState): TurnoFormErrors {
  const errors: TurnoFormErrors = {};
  if (!form.mascota_id) {
    errors.mascota_id = "Seleccioná una mascota.";
  }
  if (!form.tipo_turno_id) {
    errors.tipo_turno_id = "Seleccioná el tipo de turno.";
  }
  if (!form.veterinario_id) {
    errors.veterinario_id = "Seleccioná un profesional.";
  }
  if (!form.fecha) {
    errors.fecha = "Seleccioná una fecha.";
  }
  if (!form.fecha_hora_inicio) {
    errors.fecha_hora_inicio = "Elegí un horario disponible.";
  }
  return errors;
}

export function buildTurnoPayload(form: TurnoFormState): TurnoCreatePayload {
  return {
    mascota_id: Number(form.mascota_id),
    veterinario_id: Number(form.veterinario_id),
    tipo_turno_id: Number(form.tipo_turno_id),
    fecha_hora_inicio: form.fecha_hora_inicio,
    canal_origen: form.canal_origen,
    estado_inicial: form.confirmado ? "confirmado" : "solicitado",
  };
}

/** Prefill desde la URL (clic en un hueco del calendario): ?veterinario_id=&fecha=&hora= */
export function formDesdeQuery(params: URLSearchParams): TurnoFormState {
  const fecha = params.get("fecha") ?? "";
  return {
    ...INITIAL_TURNO_FORM,
    veterinario_id: params.get("veterinario_id") ?? "",
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "",
  };
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

function fieldClass(hasError: boolean): string {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Acceso denegado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No tenés permiso para agendar turnos.
        </p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to="/agenda">Volver a la agenda</Link>
      </Button>
    </div>
  );
}

export default function TurnoFormPage() {
  const [searchParams] = useSearchParams();
  const { permisos } = useAuth();
  const canCreate = hasPermission(permisos, "agenda:crear_turno");
  const horaPreseleccionada = searchParams.get("hora");

  const [form, setForm] = React.useState<TurnoFormState>(() => formDesdeQuery(searchParams));
  const [errors, setErrors] = React.useState<TurnoFormErrors>({});
  const [tipos, setTipos] = React.useState<TipoTurnoOpcion[]>([]);
  const [veterinarios, setVeterinarios] = React.useState<VeterinarioOpcion[]>([]);
  const [mascotaOptions, setMascotaOptions] = React.useState<MascotaAgendaOpcion[]>([]);
  const [isSearchingMascotas, setIsSearchingMascotas] = React.useState(false);
  const [franjas, setFranjas] = React.useState<FranjaDisponible[]>([]);
  const [isLoadingFranjas, setIsLoadingFranjas] = React.useState(false);
  const [franjasError, setFranjasError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [creado, setCreado] = React.useState<TurnoItem | null>(null);
  const hoy = fechaIso(new Date());

  React.useEffect(() => {
    if (!canCreate) {
      return;
    }
    void (async () => {
      try {
        const [tiposRows, vetsRows] = await Promise.all([
          apiFetch<TipoTurnoOpcion[]>("/api/agenda/tipos-turno"),
          apiFetch<VeterinarioOpcion[]>("/api/agenda/veterinarios"),
        ]);
        setTipos(tiposRows);
        setVeterinarios(vetsRows);
      } catch {
        setSubmitError("No se pudieron cargar los tipos de turno o los profesionales.");
      }
    })();
  }, [canCreate]);

  // Búsqueda de mascota (debounce 400 ms, mismo patrón que el buscador de tutores).
  React.useEffect(() => {
    const term = form.mascota_search.trim();
    if (term.length < 2) {
      setMascotaOptions([]);
      setIsSearchingMascotas(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsSearchingMascotas(true);
        try {
          const rows = await apiFetch<MascotaAgendaOpcion[]>(
            `/api/agenda/mascotas?q=${encodeURIComponent(term)}`,
          );
          if (!cancelled) {
            setMascotaOptions(rows);
          }
        } catch {
          if (!cancelled) {
            setMascotaOptions([]);
          }
        } finally {
          if (!cancelled) {
            setIsSearchingMascotas(false);
          }
        }
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.mascota_search]);

  // Franjas libres cuando están profesional + tipo + fecha (y mascota, si ya se eligió).
  React.useEffect(() => {
    if (!canCreate || !form.veterinario_id || !form.tipo_turno_id || !form.fecha) {
      setFranjas([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoadingFranjas(true);
      setFranjasError(null);
      try {
        const params = new URLSearchParams({
          veterinario_id: form.veterinario_id,
          tipo_turno_id: form.tipo_turno_id,
          fecha: form.fecha,
        });
        if (form.mascota_id) {
          params.set("mascota_id", form.mascota_id);
        }
        const data = await apiFetch<DisponibilidadResponse>(
          `/api/agenda/disponibilidad?${params.toString()}`,
        );
        if (cancelled) {
          return;
        }
        setFranjas(data.franjas);
        setForm((prev) => ({
          ...prev,
          fecha_hora_inicio: inicioPreseleccionado(
            data.franjas,
            prev.fecha_hora_inicio,
            horaPreseleccionada,
          ),
        }));
      } catch (error) {
        if (!cancelled) {
          setFranjas([]);
          setFranjasError(mensajeError(error, "No se pudo consultar la disponibilidad."));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFranjas(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canCreate, form.veterinario_id, form.tipo_turno_id, form.fecha, form.mascota_id, horaPreseleccionada]);

  if (!canCreate) {
    return <AccessDenied />;
  }

  function updateField<K extends keyof TurnoFormState>(key: K, value: TurnoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    const nextErrors = validateTurnoForm(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    setIsSubmitting(true);
    try {
      const turno = await apiFetch<TurnoItem>("/api/agenda/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTurnoPayload(form)),
      });
      setCreado(turno);
    } catch (error) {
      setSubmitError(mensajeError(error, "No se pudo agendar el turno. Intentá de nuevo."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function cargarOtro() {
    setCreado(null);
    setErrors({});
    setSubmitError(null);
    setForm((prev) => ({
      ...INITIAL_TURNO_FORM,
      veterinario_id: prev.veterinario_id,
      fecha: prev.fecha,
      tipo_turno_id: prev.tipo_turno_id,
    }));
  }

  if (creado) {
    const fecha = new Date(creado.fecha_hora_inicio);
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Turno agendado</p>
          <p className="text-muted-foreground">
            {creado.mascota_nombre} ({creado.tutor_nombre} {creado.tutor_apellido}) ·{" "}
            {creado.tipo_turno_nombre} con {creado.veterinario_nombre} {creado.veterinario_apellido} ·{" "}
            {fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}{" "}
            {horaLabel(creado.fecha_hora_inicio)} hs ·{" "}
            {creado.estado === "confirmado" ? "Confirmado" : "Solicitado"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/agenda?fecha=${fechaIso(fecha)}`}>
                <CalendarDays />
                Ver en agenda
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={cargarOtro}>
              <CalendarPlus />
              Cargar otro turno
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/agenda"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a la agenda
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo Turno</h1>
        <p className="text-sm text-muted-foreground">
          Elegí la mascota, el tipo de turno y un horario libre del profesional.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="min-w-0 space-y-6">
        <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Paciente
          </h2>
          <div className="space-y-2">
            <Label htmlFor="mascota_search">Buscar mascota (nombre, tutor o DNI)</Label>
            <Input
              id="mascota_search"
              value={form.mascota_search}
              onChange={(event) => updateField("mascota_search", event.target.value)}
              placeholder="Escribí al menos 2 caracteres..."
              className={fieldClass(Boolean(errors.mascota_id))}
            />
            {form.mascota_label ? (
              <p className="text-sm text-muted-foreground">
                Seleccionada: <span className="font-medium text-foreground">{form.mascota_label}</span>
              </p>
            ) : null}
            {isSearchingMascotas ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
            {mascotaOptions.length > 0 ? (
              <ul className="max-h-48 overflow-auto rounded-md border">
                {mascotaOptions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        updateField("mascota_id", String(m.id));
                        updateField(
                          "mascota_label",
                          `${m.nombre} (${m.especie_nombre}) · ${m.tutor_nombre} ${m.tutor_apellido}`,
                        );
                        updateField("mascota_search", "");
                        setMascotaOptions([]);
                      }}
                    >
                      <span className="font-medium">
                        {m.nombre} <span className="text-muted-foreground">· {m.especie_nombre}, {m.raza_nombre}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Tutor: {m.tutor_nombre} {m.tutor_apellido}
                        {m.tutor_dni ? ` · DNI ${m.tutor_dni}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {errors.mascota_id ? <p className="text-xs text-destructive">{errors.mascota_id}</p> : null}
          </div>
        </section>

        <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Turno
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tipo_turno_id">Tipo de turno</Label>
              <select
                id="tipo_turno_id"
                value={form.tipo_turno_id}
                onChange={(event) => updateField("tipo_turno_id", event.target.value)}
                className={`${selectClass} ${fieldClass(Boolean(errors.tipo_turno_id))}`}
              >
                <option value="">Seleccionar…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nombre} ({t.duracion_min} min)
                  </option>
                ))}
              </select>
              {errors.tipo_turno_id ? (
                <p className="text-xs text-destructive">{errors.tipo_turno_id}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="veterinario_id">Profesional</Label>
              <select
                id="veterinario_id"
                value={form.veterinario_id}
                onChange={(event) => updateField("veterinario_id", event.target.value)}
                className={`${selectClass} ${fieldClass(Boolean(errors.veterinario_id))}`}
              >
                <option value="">Seleccionar…</option>
                {veterinarios.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.nombre} {v.apellido}
                  </option>
                ))}
              </select>
              {errors.veterinario_id ? (
                <p className="text-xs text-destructive">{errors.veterinario_id}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                min={hoy}
                value={form.fecha}
                onChange={(event) => updateField("fecha", event.target.value)}
                className={fieldClass(Boolean(errors.fecha))}
              />
              {errors.fecha ? <p className="text-xs text-destructive">{errors.fecha}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Horarios</Label>
            {!form.veterinario_id || !form.tipo_turno_id || !form.fecha ? (
              <p className="text-sm text-muted-foreground">
                Elegí tipo de turno, profesional y fecha para ver los horarios libres.
              </p>
            ) : isLoadingFranjas ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando horarios…
              </p>
            ) : franjasError ? (
              <p className="text-sm text-destructive">{franjasError}</p>
            ) : franjas.length === 0 ? (
              <p className="text-sm text-muted-foreground">La clínica no atiende ese día.</p>
            ) : (
              <FranjasGrid
                franjas={franjas}
                seleccionada={form.fecha_hora_inicio}
                onSelect={(inicio) => updateField("fecha_hora_inicio", inicio)}
              />
            )}
            {errors.fecha_hora_inicio ? (
              <p className="text-xs text-destructive">{errors.fecha_hora_inicio}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="canal_origen">Canal</Label>
              <select
                id="canal_origen"
                value={form.canal_origen}
                onChange={(event) =>
                  updateField("canal_origen", event.target.value as CanalOrigenInterno)
                }
                className={selectClass}
              >
                {CANALES_INTERNOS.map((canal) => (
                  <option key={canal} value={canal}>
                    {CANAL_LABEL[canal]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="confirmado"
                checked={form.confirmado}
                onCheckedChange={(checked) => updateField("confirmado", checked === true)}
              />
              <Label htmlFor="confirmado">Turno ya confirmado con el cliente</Label>
            </div>
          </div>
        </section>

        {submitError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/agenda">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : <CalendarPlus />}
            Agendar turno
          </Button>
        </div>
      </form>
    </div>
  );
}
