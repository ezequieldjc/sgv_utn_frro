import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, PawPrint, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { useSelectTypeahead } from "@/hooks/use-select-typeahead";
import { apiFetch } from "@/lib/api";
import type {
  CatalogoOpcion,
  MascotaCreatePayload,
  MascotaCreateResponse,
  RazaOpcion,
  TutorOpcion,
} from "@/types/mascotas";

interface FormState {
  tutor_eventual: boolean;
  persona_id: string;
  tutor_label: string;
  tutor_search: string;
  nombre: string;
  especie_id: string;
  raza_id: string;
  sexo: "" | "M" | "H" | "U";
  /** false = solo mes/año (`YYYY-MM`); true = fecha exacta (`YYYY-MM-DD`). */
  fecha_conoce_dia: boolean;
  /** Valor del input activo: `YYYY-MM` o `YYYY-MM-DD` según el toggle. */
  fecha_nacimiento: string;
  peso_inicial_kg: string;
  microchip: string;
  alertas_medicas: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  tutor_eventual: false,
  persona_id: "",
  tutor_label: "",
  tutor_search: "",
  nombre: "",
  especie_id: "",
  raza_id: "",
  sexo: "",
  fecha_conoce_dia: false,
  fecha_nacimiento: "",
  peso_inicial_kg: "",
  microchip: "",
  alertas_medicas: "",
};

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function isValidYearMonth(value: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Mes/año → día 1; fecha exacta → tal cual. */
function fechaNacimientoToIso(form: FormState): string | null {
  const raw = form.fecha_nacimiento.trim();
  if (!raw) {
    return null;
  }
  if (form.fecha_conoce_dia) {
    return isValidIsoDate(raw) ? raw : null;
  }
  if (!isValidYearMonth(raw)) {
    return null;
  }
  return `${raw}-01`;
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.tutor_eventual && !form.persona_id) {
    errors.persona_id = "Seleccioná un tutor o marcá tutor eventual.";
  }
  if (!form.nombre.trim()) {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!form.especie_id) {
    errors.especie_id = "Seleccioná una especie.";
  }
  if (!form.raza_id) {
    errors.raza_id = "Seleccioná una raza.";
  }
  if (form.fecha_nacimiento.trim()) {
    if (form.fecha_conoce_dia) {
      if (!isValidIsoDate(form.fecha_nacimiento.trim())) {
        errors.fecha_nacimiento = "Seleccioná una fecha válida.";
      }
    } else if (!isValidYearMonth(form.fecha_nacimiento.trim())) {
      errors.fecha_nacimiento = "Seleccioná un mes y año válidos.";
    }
  }
  if (form.peso_inicial_kg.trim()) {
    const peso = Number(form.peso_inicial_kg.replace(",", "."));
    if (Number.isNaN(peso) || peso <= 0) {
      errors.peso_inicial_kg = "Ingresá un peso válido mayor a 0.";
    }
  }
  return errors;
}

function buildMascotaPayload(form: FormState): MascotaCreatePayload {
  const pesoRaw = form.peso_inicial_kg.trim().replace(",", ".");
  return {
    persona_id: form.tutor_eventual ? null : Number(form.persona_id),
    tutor_eventual: form.tutor_eventual,
    nombre: form.nombre.trim(),
    especie_id: Number(form.especie_id),
    raza_id: Number(form.raza_id),
    sexo: form.sexo || null,
    fecha_nacimiento: fechaNacimientoToIso(form),
    peso_inicial_kg: pesoRaw ? Number(pesoRaw) : null,
    microchip: form.microchip.trim() || null,
    alertas_medicas: form.alertas_medicas.trim() || null,
  };
}

export { INITIAL_FORM, validateForm, buildMascotaPayload, fechaNacimientoToIso };

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
          No tenés permiso para registrar mascotas.
        </p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to="/mascotas">Volver al listado</Link>
      </Button>
    </div>
  );
}

export default function MascotaFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { permisos } = useAuth();
  const { handleTypeaheadKeyDown, clearTypeahead } = useSelectTypeahead();
  const canCreate = hasPermission(permisos, "mascotas:crear");

  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [especies, setEspecies] = React.useState<CatalogoOpcion[]>([]);
  const [razas, setRazas] = React.useState<RazaOpcion[]>([]);
  const [razaDefaultNombre, setRazaDefaultNombre] = React.useState("Sin raza definida");
  const [tutorOptions, setTutorOptions] = React.useState<TutorOpcion[]>([]);
  const [isSearchingTutores, setIsSearchingTutores] = React.useState(false);
  const [tutorSearchError, setTutorSearchError] = React.useState<string | null>(null);
  const [tutorSearchDone, setTutorSearchDone] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<MascotaCreateResponse | null>(null);

  React.useEffect(() => {
    if (!canCreate) {
      return;
    }
    void (async () => {
      try {
        const [esp, cfg] = await Promise.all([
          apiFetch<CatalogoOpcion[]>("/api/mascotas/especies"),
          apiFetch<{ nombre: string }>("/api/mascotas/config/raza-default"),
        ]);
        setEspecies(esp);
        setRazaDefaultNombre(cfg.nombre);
      } catch {
        setSubmitError("No se pudieron cargar especies / configuración.");
      }
    })();
  }, [canCreate]);

  React.useEffect(() => {
    const clienteId = searchParams.get("cliente_id");
    if (!canCreate || !clienteId) {
      return;
    }
    void (async () => {
      try {
        const match = await apiFetch<TutorOpcion>(`/api/mascotas/tutores/${clienteId}`);
        setForm((prev) => ({
          ...prev,
          persona_id: String(match.id),
          tutor_label: `${match.nombre} ${match.apellido}${match.dni ? ` · DNI ${match.dni}` : ""}`,
          tutor_eventual: false,
        }));
      } catch {
        // sin preselección si el id no existe o no es cliente
      }
    })();
  }, [canCreate, searchParams]);

  React.useEffect(() => {
    if (!form.especie_id) {
      setRazas([]);
      return;
    }
    void (async () => {
      try {
        const rows = await apiFetch<RazaOpcion[]>(
          `/api/mascotas/razas?especie_id=${form.especie_id}`,
        );
        setRazas(rows);
        const defaultRaza = rows.find(
          (item) => item.nombre.toLowerCase() === razaDefaultNombre.toLowerCase(),
        );
        setForm((prev) => ({
          ...prev,
          raza_id: defaultRaza ? String(defaultRaza.id) : "",
        }));
      } catch {
        setRazas([]);
      }
    })();
  }, [form.especie_id, razaDefaultNombre]);

  React.useEffect(() => {
    const term = form.tutor_search.trim();
    const digitsOnly = /^\d+$/.test(term);
    const minLength = digitsOnly ? 2 : 2;

    if (form.tutor_eventual || term.length < minLength) {
      setTutorOptions([]);
      setTutorSearchError(null);
      setTutorSearchDone(false);
      setIsSearchingTutores(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsSearchingTutores(true);
        setTutorSearchError(null);
        setTutorSearchDone(false);
        try {
          const rows = await apiFetch<TutorOpcion[]>(
            `/api/mascotas/tutores?q=${encodeURIComponent(term)}`,
          );
          if (cancelled) {
            return;
          }
          setTutorOptions(rows);
          setTutorSearchDone(true);
        } catch (error) {
          if (cancelled) {
            return;
          }
          setTutorOptions([]);
          setTutorSearchDone(true);
          setTutorSearchError(
            (error as Error).message || "No se pudo buscar tutores. Revisá la conexión.",
          );
        } finally {
          if (!cancelled) {
            setIsSearchingTutores(false);
          }
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.tutor_search, form.tutor_eventual]);

  if (!canCreate) {
    return <AccessDenied />;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
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
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = buildMascotaPayload(form);

    setIsSubmitting(true);
    try {
      const created = await apiFetch<MascotaCreateResponse>("/api/mascotas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(created);
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = (error as Error).message;
      if (status === 400) {
        setSubmitError(message || "Datos inválidos para el alta.");
      } else if (status === 404) {
        setSubmitError(message || "No se encontró el tutor o la configuración.");
      } else if (status === 409) {
        setSubmitError(message || "Microchip duplicado.");
      } else if (status === 403) {
        setSubmitError("No tenés permisos para crear mascotas.");
      } else {
        setSubmitError("No se pudo crear la mascota. Intentá de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PawPrint className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Mascotas y Clientes
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva Mascota</h1>
        <p className="text-sm text-muted-foreground">
          Alta rápida de admisión. El estado operativo se registra como ACTIVA.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="min-w-0 space-y-8">
        <section className="min-w-0 space-y-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tutor
          </h2>
          <div className="flex items-center gap-2">
            <Checkbox
              id="tutor_eventual"
              checked={form.tutor_eventual}
              onCheckedChange={(checked) => {
                const on = checked === true;
                updateField("tutor_eventual", on);
                if (on) {
                  updateField("persona_id", "");
                  updateField("tutor_label", "");
                  updateField("tutor_search", "");
                  setTutorOptions([]);
                }
              }}
            />
            <Label htmlFor="tutor_eventual">
              Mascota sin tutor registrado (Tutor Eventual)
            </Label>
          </div>

          {!form.tutor_eventual ? (
            <div className="min-w-0 space-y-2">
              <Label htmlFor="tutor_search">Buscar tutor (DNI o nombre)</Label>
              <Input
                id="tutor_search"
                value={form.tutor_search}
                onChange={(event) => updateField("tutor_search", event.target.value)}
                placeholder="Escribí al menos 2 caracteres..."
                className={fieldClass(Boolean(errors.persona_id))}
              />
              {form.tutor_label ? (
                <p className="text-sm text-muted-foreground">
                  Seleccionado: <span className="font-medium text-foreground">{form.tutor_label}</span>
                </p>
              ) : null}
              {isSearchingTutores ? (
                <p className="text-xs text-muted-foreground">Buscando…</p>
              ) : null}
              {tutorSearchError ? (
                <p className="text-xs text-destructive break-words">{tutorSearchError}</p>
              ) : null}
              {tutorOptions.length > 0 ? (
                <ul className="max-h-48 overflow-auto rounded-md border">
                  {tutorOptions.map((tutor) => (
                    <li key={tutor.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          updateField("persona_id", String(tutor.id));
                          updateField(
                            "tutor_label",
                            `${tutor.nombre} ${tutor.apellido}${tutor.dni ? ` · DNI ${tutor.dni}` : ""}`,
                          );
                          updateField("tutor_search", "");
                          setTutorOptions([]);
                          setTutorSearchDone(false);
                          setTutorSearchError(null);
                        }}
                      >
                        <span className="font-medium">
                          {tutor.nombre} {tutor.apellido}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tutor.dni ? `DNI ${tutor.dni}` : "Sin DNI"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!isSearchingTutores &&
              tutorSearchDone &&
              !tutorSearchError &&
              tutorOptions.length === 0 &&
              form.tutor_search.trim().length > 0 ? (
                <p className="max-w-full text-xs leading-relaxed text-muted-foreground break-words">
                  No hay clientes con ese DNI o nombre. Solo aparecen personas
                  registradas como cliente (no usuarios del sistema).
                </p>
              ) : null}
              {errors.persona_id ? (
                <p className="text-xs text-destructive">{errors.persona_id}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Se asignará el tutor eventual configurado en el sistema.
            </p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de la mascota
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(event) => updateField("nombre", event.target.value)}
                className={fieldClass(Boolean(errors.nombre))}
              />
              {errors.nombre ? (
                <p className="text-xs text-destructive">{errors.nombre}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="especie_id">Especie</Label>
              <select
                id="especie_id"
                value={form.especie_id}
                onBlur={clearTypeahead}
                onKeyDown={(event) => {
                  handleTypeaheadKeyDown(
                    event,
                    [
                      { value: "", label: "Seleccionar…" },
                      ...especies.map((item) => ({
                        value: String(item.id),
                        label: item.nombre,
                      })),
                    ],
                    form.especie_id,
                    (value) => updateField("especie_id", value),
                  );
                }}
                onChange={(event) => updateField("especie_id", event.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${fieldClass(Boolean(errors.especie_id))}`}
              >
                <option value="">Seleccionar…</option>
                {especies.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {errors.especie_id ? (
                <p className="text-xs text-destructive">{errors.especie_id}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="raza_id">Raza</Label>
              <select
                id="raza_id"
                value={form.raza_id}
                disabled={!form.especie_id}
                onBlur={clearTypeahead}
                onKeyDown={(event) => {
                  handleTypeaheadKeyDown(
                    event,
                    [
                      { value: "", label: "Seleccionar…" },
                      ...razas.map((item) => ({
                        value: String(item.id),
                        label: item.nombre,
                      })),
                    ],
                    form.raza_id,
                    (value) => updateField("raza_id", value),
                  );
                }}
                onChange={(event) => updateField("raza_id", event.target.value)}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${fieldClass(Boolean(errors.raza_id))}`}
              >
                <option value="">Seleccionar…</option>
                {razas.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {errors.raza_id ? (
                <p className="text-xs text-destructive">{errors.raza_id}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo (opcional)</Label>
              <select
                id="sexo"
                value={form.sexo}
                onBlur={clearTypeahead}
                onKeyDown={(event) => {
                  handleTypeaheadKeyDown(
                    event,
                    [
                      { value: "", label: "Seleccionar…" },
                      { value: "M", label: "M - Macho" },
                      { value: "H", label: "H - Hembra" },
                      { value: "U", label: "U - Indeterminado" },
                    ],
                    form.sexo,
                    (value) => updateField("sexo", value as FormState["sexo"]),
                  );
                }}
                onChange={(event) =>
                  updateField("sexo", event.target.value as FormState["sexo"])
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Seleccionar…</option>
                <option value="M">M - Macho</option>
                <option value="H">H - Hembra</option>
                <option value="U">U - Indeterminado</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fecha_nacimiento">Fecha de nacimiento (opcional)</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fecha_conoce_dia"
                  checked={form.fecha_conoce_dia}
                  onCheckedChange={(checked) => {
                    const exacto = checked === true;
                    const prev = form.fecha_nacimiento.trim();
                    let nextValue = "";
                    if (exacto) {
                      // Mes/año → fecha con día 1; si ya era fecha exacta, se conserva.
                      if (/^\d{4}-\d{2}$/.test(prev)) {
                        nextValue = `${prev}-01`;
                      } else if (/^\d{4}-\d{2}-\d{2}$/.test(prev)) {
                        nextValue = prev;
                      }
                    } else if (/^\d{4}-\d{2}/.test(prev)) {
                      nextValue = prev.slice(0, 7);
                    }
                    setForm((current) => ({
                      ...current,
                      fecha_conoce_dia: exacto,
                      fecha_nacimiento: nextValue,
                    }));
                    setErrors((current) => {
                      if (!current.fecha_nacimiento) {
                        return current;
                      }
                      const next = { ...current };
                      delete next.fecha_nacimiento;
                      return next;
                    });
                  }}
                />
                <Label htmlFor="fecha_conoce_dia" className="font-normal">
                  Conozco el día exacto de nacimiento
                </Label>
              </div>
              {form.fecha_conoce_dia ? (
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(event) =>
                    updateField("fecha_nacimiento", event.target.value)
                  }
                  className={fieldClass(Boolean(errors.fecha_nacimiento))}
                />
              ) : (
                <Input
                  id="fecha_nacimiento"
                  type="month"
                  value={form.fecha_nacimiento}
                  onChange={(event) =>
                    updateField("fecha_nacimiento", event.target.value)
                  }
                  className={fieldClass(Boolean(errors.fecha_nacimiento))}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {form.fecha_conoce_dia
                  ? "Se enviará la fecha completa (YYYY-MM-DD)."
                  : "Si solo conocés mes y año, se guardará el día 1 de ese mes."}
              </p>
              {errors.fecha_nacimiento ? (
                <p className="text-xs text-destructive">{errors.fecha_nacimiento}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="peso_inicial_kg">Peso inicial kg (opcional)</Label>
              <Input
                id="peso_inicial_kg"
                inputMode="decimal"
                value={form.peso_inicial_kg}
                onChange={(event) =>
                  updateField(
                    "peso_inicial_kg",
                    event.target.value.replace(/[^\d.,]/g, ""),
                  )
                }
                className={fieldClass(Boolean(errors.peso_inicial_kg))}
              />
              {errors.peso_inicial_kg ? (
                <p className="text-xs text-destructive">{errors.peso_inicial_kg}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="microchip">Microchip (opcional)</Label>
              <Input
                id="microchip"
                value={form.microchip}
                onChange={(event) => updateField("microchip", event.target.value)}
                maxLength={15}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="alertas_medicas">Alertas médicas (opcional)</Label>
              <Textarea
                id="alertas_medicas"
                value={form.alertas_medicas}
                onChange={(event) => updateField("alertas_medicas", event.target.value)}
              />
            </div>
          </div>
        </section>

        {submitError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            <ArrowLeft className="size-4" />
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
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

      <Dialog
        open={success !== null}
        onOpenChange={(open) => {
          if (!open && success) {
            navigate("/mascotas");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mascota creada correctamente</DialogTitle>
            <DialogDescription>
              Se registró «{success?.nombre}» con estado ACTIVA
              {success?.peso_registrado ? " y se guardó el peso inicial." : "."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => navigate("/mascotas")}>
              Ir al listado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
