import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  MascotaDetail,
  MascotaUpdatePayload,
  RazaOpcion,
  TutorOpcion,
} from "@/types/mascotas";

interface EditFormState {
  persona_id: string;
  tutor_label: string;
  tutor_search: string;
  nombre: string;
  especie_id: string;
  especie_nombre: string;
  raza_id: string;
  mascota_estado_id: string;
  sexo: "" | "M" | "H" | "U";
  fecha_conoce_dia: boolean;
  fecha_nacimiento: string;
  microchip: string;
  alertas_medicas: string;
  pelaje_id: string;
  tamanio_id: string;
  habitat_id: string;
  estado_reproductivo_id: string;
  temperamento_id: string;
}

type FormErrors = Partial<Record<keyof EditFormState, string>>;

const INITIAL_FORM: EditFormState = {
  persona_id: "",
  tutor_label: "",
  tutor_search: "",
  nombre: "",
  especie_id: "",
  especie_nombre: "",
  raza_id: "",
  mascota_estado_id: "",
  sexo: "",
  fecha_conoce_dia: false,
  fecha_nacimiento: "",
  microchip: "",
  alertas_medicas: "",
  pelaje_id: "",
  tamanio_id: "",
  habitat_id: "",
  estado_reproductivo_id: "",
  temperamento_id: "",
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

function fechaFromDetail(iso: string | null): Pick<
  EditFormState,
  "fecha_conoce_dia" | "fecha_nacimiento"
> {
  if (!iso) {
    return { fecha_conoce_dia: false, fecha_nacimiento: "" };
  }
  const day = iso.slice(8, 10);
  if (day === "01") {
    return { fecha_conoce_dia: false, fecha_nacimiento: iso.slice(0, 7) };
  }
  return { fecha_conoce_dia: true, fecha_nacimiento: iso };
}

function fechaNacimientoToIso(form: EditFormState): string | null {
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

function validateEditForm(form: EditFormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.persona_id) {
    errors.persona_id = "Seleccioná un tutor.";
  }
  if (!form.nombre.trim()) {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!form.raza_id) {
    errors.raza_id = "Seleccioná una raza.";
  }
  if (!form.mascota_estado_id) {
    errors.mascota_estado_id = "Seleccioná un estado.";
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
  return errors;
}

function optionalId(value: string): number | null {
  return value ? Number(value) : null;
}

function buildUpdatePayload(form: EditFormState): MascotaUpdatePayload {
  return {
    nombre: form.nombre.trim(),
    persona_id: Number(form.persona_id),
    raza_id: Number(form.raza_id),
    mascota_estado_id: Number(form.mascota_estado_id),
    sexo: form.sexo || null,
    fecha_nacimiento: fechaNacimientoToIso(form),
    microchip: form.microchip.trim() || null,
    alertas_medicas: form.alertas_medicas.trim() || null,
    pelaje_id: optionalId(form.pelaje_id),
    tamanio_id: optionalId(form.tamanio_id),
    habitat_id: optionalId(form.habitat_id),
    estado_reproductivo_id: optionalId(form.estado_reproductivo_id),
    temperamento_id: optionalId(form.temperamento_id),
  };
}

export { INITIAL_FORM, validateEditForm, buildUpdatePayload, fechaNacimientoToIso };

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
          No tenés permiso para editar mascotas.
        </p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to="/mascotas">Volver al listado</Link>
      </Button>
    </div>
  );
}

export default function MascotaEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const { handleTypeaheadKeyDown, clearTypeahead } = useSelectTypeahead();
  const canEdit = hasPermission(permisos, "mascotas:editar");

  const [form, setForm] = React.useState<EditFormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [razas, setRazas] = React.useState<RazaOpcion[]>([]);
  const [estados, setEstados] = React.useState<CatalogoOpcion[]>([]);
  const [pelajes, setPelajes] = React.useState<CatalogoOpcion[]>([]);
  const [tamanios, setTamanios] = React.useState<CatalogoOpcion[]>([]);
  const [habitats, setHabitats] = React.useState<CatalogoOpcion[]>([]);
  const [estadosRepro, setEstadosRepro] = React.useState<CatalogoOpcion[]>([]);
  const [temperamentos, setTemperamentos] = React.useState<CatalogoOpcion[]>([]);
  const [tutorOptions, setTutorOptions] = React.useState<TutorOpcion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSearchingTutores, setIsSearchingTutores] = React.useState(false);
  const [tutorSearchError, setTutorSearchError] = React.useState<string | null>(null);
  const [tutorSearchDone, setTutorSearchDone] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<MascotaDetail | null>(null);

  React.useEffect(() => {
    if (!canEdit || !id) {
      setIsLoading(false);
      return;
    }
    void (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const detail = await apiFetch<MascotaDetail>(`/api/mascotas/${id}`);
        const fecha = fechaFromDetail(detail.fecha_nacimiento);
        setForm({
          persona_id: String(detail.persona_id),
          tutor_label: `${detail.tutor_nombre} ${detail.tutor_apellido}${
            detail.tutor_dni ? ` · DNI ${detail.tutor_dni}` : ""
          }`,
          tutor_search: "",
          nombre: detail.nombre,
          especie_id: String(detail.especie_id),
          especie_nombre: detail.especie_nombre,
          raza_id: String(detail.raza_id),
          mascota_estado_id: String(detail.mascota_estado_id),
          sexo: detail.sexo ?? "",
          fecha_conoce_dia: fecha.fecha_conoce_dia,
          fecha_nacimiento: fecha.fecha_nacimiento,
          microchip: detail.microchip ?? "",
          alertas_medicas: detail.alertas_medicas ?? "",
          pelaje_id: detail.pelaje_id != null ? String(detail.pelaje_id) : "",
          tamanio_id: detail.tamanio_id != null ? String(detail.tamanio_id) : "",
          habitat_id: detail.habitat_id != null ? String(detail.habitat_id) : "",
          estado_reproductivo_id:
            detail.estado_reproductivo_id != null
              ? String(detail.estado_reproductivo_id)
              : "",
          temperamento_id:
            detail.temperamento_id != null ? String(detail.temperamento_id) : "",
        });

        const [
          razasRows,
          estadosRows,
          pelajeRows,
          tamanioRows,
          habitatRows,
          reproRows,
          tempRows,
        ] = await Promise.all([
          apiFetch<RazaOpcion[]>(`/api/mascotas/razas?especie_id=${detail.especie_id}`),
          apiFetch<CatalogoOpcion[]>("/api/mascotas/estados"),
          apiFetch<CatalogoOpcion[]>(
            `/api/mascotas/catalogos/pelajes?especie_id=${detail.especie_id}`,
          ),
          apiFetch<CatalogoOpcion[]>(
            `/api/mascotas/catalogos/tamanios?especie_id=${detail.especie_id}`,
          ),
          apiFetch<CatalogoOpcion[]>(
            `/api/mascotas/catalogos/habitats?especie_id=${detail.especie_id}`,
          ),
          apiFetch<CatalogoOpcion[]>(
            `/api/mascotas/catalogos/estados-reproductivos?especie_id=${detail.especie_id}`,
          ),
          apiFetch<CatalogoOpcion[]>(
            `/api/mascotas/catalogos/temperamentos?especie_id=${detail.especie_id}`,
          ),
        ]);
        setRazas(razasRows);
        setEstados(estadosRows);
        setPelajes(pelajeRows);
        setTamanios(tamanioRows);
        setHabitats(habitatRows);
        setEstadosRepro(reproRows);
        setTemperamentos(tempRows);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 404) {
          setLoadError("No se encontró la mascota indicada.");
        } else if (status === 403) {
          setLoadError("No tenés permisos para editar esta mascota.");
        } else {
          setLoadError("No se pudo cargar la mascota.");
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [canEdit, id]);

  React.useEffect(() => {
    const term = form.tutor_search.trim();
    if (term.length < 2) {
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
          if (!cancelled) {
            setTutorOptions(rows);
            setTutorSearchDone(true);
          }
        } catch (error) {
          if (!cancelled) {
            setTutorOptions([]);
            setTutorSearchDone(true);
            setTutorSearchError(
              (error as Error).message || "No se pudo buscar tutores.",
            );
          }
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
  }, [form.tutor_search]);

  if (!canEdit) {
    return <AccessDenied />;
  }

  function updateField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
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
    if (isSubmitting || !id) {
      return;
    }
    const nextErrors = validateEditForm(form);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await apiFetch<MascotaDetail>(`/api/mascotas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildUpdatePayload(form)),
      });
      setSuccess(updated);
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = (error as Error).message;
      if (status === 400) {
        setSubmitError(message || "Datos inválidos para la edición.");
      } else if (status === 404) {
        setSubmitError(message || "No se encontró la mascota o el tutor.");
      } else if (status === 409) {
        setSubmitError(message || "Microchip duplicado.");
      } else if (status === 403) {
        setSubmitError("No tenés permisos para editar mascotas.");
      } else {
        setSubmitError("No se pudo guardar. Intentá de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Cargando mascota…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/mascotas">Volver al listado</Link>
        </Button>
      </div>
    );
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
        <h1 className="text-2xl font-semibold tracking-tight">Editar Mascota</h1>
        <p className="text-sm text-muted-foreground">
          Actualizá los datos clínicos y de admisión. La especie no se puede cambiar.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="min-w-0 space-y-8">
        <section className="min-w-0 space-y-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Identidad
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
              <Input id="especie_id" value={form.especie_nombre} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="raza_id">Raza</Label>
              <select
                id="raza_id"
                value={form.raza_id}
                onBlur={clearTypeahead}
                onKeyDown={(event) => {
                  handleTypeaheadKeyDown(
                    event,
                    razas.map((item) => ({
                      value: String(item.id),
                      label: item.nombre,
                    })),
                    form.raza_id,
                    (value) => updateField("raza_id", value),
                  );
                }}
                onChange={(event) => updateField("raza_id", event.target.value)}
                className={`${selectClass} ${fieldClass(Boolean(errors.raza_id))}`}
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mascota_estado_id">Estado</Label>
              <select
                id="mascota_estado_id"
                value={form.mascota_estado_id}
                onBlur={clearTypeahead}
                onKeyDown={(event) => {
                  handleTypeaheadKeyDown(
                    event,
                    estados.map((item) => ({
                      value: String(item.id),
                      label: item.nombre,
                    })),
                    form.mascota_estado_id,
                    (value) => updateField("mascota_estado_id", value),
                  );
                }}
                onChange={(event) => updateField("mascota_estado_id", event.target.value)}
                className={`${selectClass} ${fieldClass(Boolean(errors.mascota_estado_id))}`}
              >
                <option value="">Seleccionar…</option>
                {estados.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
              {errors.mascota_estado_id ? (
                <p className="text-xs text-destructive">{errors.mascota_estado_id}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="min-w-0 space-y-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Tutor
          </h2>
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
                Seleccionado:{" "}
                <span className="font-medium text-foreground">{form.tutor_label}</span>
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
                          `${tutor.nombre} ${tutor.apellido}${
                            tutor.dni ? ` · DNI ${tutor.dni}` : ""
                          }`,
                        );
                        updateField("tutor_search", "");
                        setTutorOptions([]);
                        setTutorSearchDone(false);
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
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos clínicos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
                  onChange={(event) => updateField("fecha_nacimiento", event.target.value)}
                  className={fieldClass(Boolean(errors.fecha_nacimiento))}
                />
              ) : (
                <Input
                  id="fecha_nacimiento"
                  type="month"
                  value={form.fecha_nacimiento}
                  onChange={(event) => updateField("fecha_nacimiento", event.target.value)}
                  className={fieldClass(Boolean(errors.fecha_nacimiento))}
                />
              )}
              {errors.fecha_nacimiento ? (
                <p className="text-xs text-destructive">{errors.fecha_nacimiento}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo (opcional)</Label>
              <select
                id="sexo"
                value={form.sexo}
                onChange={(event) =>
                  updateField("sexo", event.target.value as EditFormState["sexo"])
                }
                className={selectClass}
              >
                <option value="">Seleccionar…</option>
                <option value="M">M - Macho</option>
                <option value="H">H - Hembra</option>
                <option value="U">U - Indeterminado</option>
              </select>
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
            <div className="space-y-2">
              <Label htmlFor="pelaje_id">Pelaje (opcional)</Label>
              <select
                id="pelaje_id"
                value={form.pelaje_id}
                onChange={(event) => updateField("pelaje_id", event.target.value)}
                className={selectClass}
              >
                <option value="">Sin asignar</option>
                {pelajes.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tamanio_id">Tamaño (opcional)</Label>
              <select
                id="tamanio_id"
                value={form.tamanio_id}
                onChange={(event) => updateField("tamanio_id", event.target.value)}
                className={selectClass}
              >
                <option value="">Sin asignar</option>
                {tamanios.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="habitat_id">Hábitat (opcional)</Label>
              <select
                id="habitat_id"
                value={form.habitat_id}
                onChange={(event) => updateField("habitat_id", event.target.value)}
                className={selectClass}
              >
                <option value="">Sin asignar</option>
                {habitats.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado_reproductivo_id">Estado reproductivo (opcional)</Label>
              <select
                id="estado_reproductivo_id"
                value={form.estado_reproductivo_id}
                onChange={(event) =>
                  updateField("estado_reproductivo_id", event.target.value)
                }
                className={selectClass}
              >
                <option value="">Sin asignar</option>
                {estadosRepro.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperamento_id">Temperamento (opcional)</Label>
              <select
                id="temperamento_id"
                value={form.temperamento_id}
                onChange={(event) => updateField("temperamento_id", event.target.value)}
                className={selectClass}
              >
                <option value="">Sin asignar</option>
                {temperamentos.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="alertas_medicas">Alertas médicas (opcional)</Label>
              <Textarea
                id="alertas_medicas"
                value={form.alertas_medicas}
                onChange={(event) => updateField("alertas_medicas", event.target.value)}
                rows={3}
              />
            </div>
          </div>
        </section>

        {submitError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/mascotas")}>
            <ArrowLeft className="size-4" />
            Cancelar
          </Button>
        </div>
      </form>

      <Dialog open={success !== null} onOpenChange={(open) => !open && setSuccess(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mascota actualizada</DialogTitle>
            <DialogDescription>
              {success
                ? `Se guardaron los cambios de ${success.nombre}.`
                : "Los cambios se guardaron correctamente."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => navigate("/mascotas")}>
              Volver al listado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
