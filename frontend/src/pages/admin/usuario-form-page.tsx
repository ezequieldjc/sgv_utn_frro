import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldOff, UserPlus } from "lucide-react";

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
import { apiFetch } from "@/lib/api";
import type {
  RolListItem,
  UsuarioCreatePayload,
  UsuarioCreateResponse,
} from "@/types/usuarios";

export type UsuarioFormMode = "create" | "edit" | "view";

interface FormState {
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: "" | "M" | "F" | "X";
  celular: string;
  mail: string;
  pais: string;
  provincia: string;
  ciudad: string;
  calle: string;
  altura: string;
  cp: string;
  departamento: string;
  notas: string;
  rol_id: string;
  habilitado: boolean;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  nombre: "",
  apellido: "",
  dni: "",
  fecha_nacimiento: "",
  sexo: "",
  celular: "",
  mail: "",
  pais: "Argentina",
  provincia: "Buenos Aires",
  ciudad: "",
  calle: "",
  altura: "",
  cp: "",
  departamento: "",
  notas: "",
  rol_id: "",
  habilitado: true,
};

const FIELD_ORDER: Array<keyof FormState> = [
  "nombre",
  "apellido",
  "dni",
  "fecha_nacimiento",
  "sexo",
  "celular",
  "mail",
  "pais",
  "provincia",
  "ciudad",
  "calle",
  "altura",
  "cp",
  "departamento",
  "notas",
  "rol_id",
];

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function previewUsername(nombre: string, apellido: string): string {
  const n = stripAccents(nombre).trim().toLowerCase();
  const a = stripAccents(apellido).replace(/\s+/g, "").toLowerCase();
  if (!n || !a) {
    return "";
  }
  return `${n[0]}${a}`;
}

function maskFechaNacimiento(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function fechaToIso(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) {
    return null;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitizeCelular(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.nombre.trim()) {
    errors.nombre = "El nombre es obligatorio.";
  }
  if (!form.apellido.trim()) {
    errors.apellido = "El apellido es obligatorio.";
  }
  if (!form.dni.trim()) {
    errors.dni = "El DNI es obligatorio.";
  } else if (!/^\d+$/.test(form.dni.trim())) {
    errors.dni = "El DNI debe contener solo números.";
  }
  if (!form.fecha_nacimiento.trim()) {
    errors.fecha_nacimiento = "La fecha de nacimiento es obligatoria.";
  } else if (!fechaToIso(form.fecha_nacimiento)) {
    errors.fecha_nacimiento = "Usá el formato dd/mm/yyyy con una fecha válida.";
  }
  if (!form.sexo) {
    errors.sexo = "Seleccioná el sexo.";
  }
  if (!form.celular.trim()) {
    errors.celular = "El celular es obligatorio.";
  } else if (!sanitizeCelular(form.celular)) {
    errors.celular = "El celular debe incluir números.";
  }
  if (form.mail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.mail.trim())) {
    errors.mail = "Ingresá un email válido.";
  }
  if (!form.ciudad.trim()) {
    errors.ciudad = "La ciudad es obligatoria.";
  }
  if (!form.calle.trim()) {
    errors.calle = "La calle es obligatoria.";
  }
  if (!form.altura.trim()) {
    errors.altura = "La altura es obligatoria.";
  }
  if (!form.cp.trim()) {
    errors.cp = "El código postal es obligatorio.";
  } else if (!/^\d+$/.test(form.cp.trim())) {
    errors.cp = "El código postal debe ser numérico.";
  }
  if (!form.rol_id) {
    errors.rol_id = "Seleccioná un rol.";
  }

  return errors;
}

function fieldClass(hasError: boolean): string {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

function AccessDenied({ message }: { message: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Acceso denegado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to="/admin/usuarios">Volver al listado</Link>
      </Button>
    </div>
  );
}

export default function UsuarioFormPage({
  mode = "create",
}: {
  mode?: UsuarioFormMode;
}) {
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const canCreate = hasPermission(permisos, "usuarios:crear");
  const canEdit = hasPermission(permisos, "usuarios:editar");
  const canView = hasPermission(permisos, "usuarios:ver");

  const readOnly =
    mode === "view" || (mode === "create" ? !canCreate : !canEdit && canView);

  const [form, setForm] = React.useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [roles, setRoles] = React.useState<RolListItem[]>([]);
  const [rolesError, setRolesError] = React.useState<string | null>(null);
  const [isLoadingRoles, setIsLoadingRoles] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<UsuarioCreateResponse | null>(null);

  const fieldRefs = React.useRef<Partial<Record<keyof FormState, HTMLElement | null>>>(
    {}
  );

  React.useEffect(() => {
    if (mode === "create" && !canCreate) {
      return;
    }

    let cancelled = false;

    async function loadRoles() {
      setIsLoadingRoles(true);
      setRolesError(null);
      try {
        const data = await apiFetch<RolListItem[]>("/api/roles");
        if (!cancelled) {
          setRoles(data);
        }
      } catch {
        if (!cancelled) {
          setRoles([]);
          setRolesError("No se pudieron cargar los roles.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRoles(false);
        }
      }
    }

    void loadRoles();
    return () => {
      cancelled = true;
    };
  }, [mode, canCreate]);

  if (mode === "create" && !canCreate) {
    return (
      <AccessDenied message="No tenés permiso para crear usuarios." />
    );
  }

  if ((mode === "edit" || mode === "view") && !canView && !canEdit) {
    return (
      <AccessDenied message="No tenés permiso para ver este usuario." />
    );
  }

  const usernamePreview = previewUsername(form.nombre, form.apellido);

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

  function focusFirstError(nextErrors: FormErrors) {
    const firstKey = FIELD_ORDER.find((key) => Boolean(nextErrors[key]));
    if (!firstKey) {
      return;
    }
    const el = fieldRefs.current[firstKey];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (readOnly || isSubmitting) {
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => focusFirstError(nextErrors), 0);
      return;
    }

    const isoFecha = fechaToIso(form.fecha_nacimiento);
    if (!isoFecha || !form.sexo) {
      return;
    }

    const payload: UsuarioCreatePayload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      fecha_nacimiento: isoFecha,
      sexo: form.sexo,
      celular: sanitizeCelular(form.celular),
      mail: form.mail.trim() ? form.mail.trim() : null,
      domicilio: {
        pais: form.pais,
        provincia: form.provincia,
        ciudad: form.ciudad.trim(),
        calle: form.calle.trim(),
        altura: form.altura.trim(),
        cp: form.cp.trim(),
        departamento: form.departamento.trim() ? form.departamento.trim() : null,
        notas: form.notas.trim() ? form.notas.trim() : null,
      },
      rol_id: Number(form.rol_id),
      habilitado: form.habilitado,
    };

    setIsSubmitting(true);
    try {
      const created = await apiFetch<UsuarioCreateResponse>("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSuccess(created);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        setSubmitError("Ya existe una persona con ese DNI.");
      } else if (status === 404) {
        setSubmitError("El rol seleccionado no es válido.");
      } else if (status === 403) {
        setSubmitError("No tenés permisos para crear usuarios.");
      } else {
        setSubmitError("No se pudo crear el usuario. Intentá de nuevo.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserPlus className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Admin</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create"
            ? "Nuevo usuario"
            : mode === "edit"
              ? "Editar usuario"
              : "Detalle de usuario"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Completá los datos de la persona, domicilio y cuenta de acceso.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-8">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de la persona
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                ref={(el) => {
                  fieldRefs.current.nombre = el;
                }}
                value={form.nombre}
                onChange={(e) => updateField("nombre", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.nombre))}
              />
              {errors.nombre ? (
                <p className="text-xs text-destructive">{errors.nombre}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="apellido">Apellido</Label>
              <Input
                id="apellido"
                ref={(el) => {
                  fieldRefs.current.apellido = el;
                }}
                value={form.apellido}
                onChange={(e) => updateField("apellido", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.apellido))}
              />
              {errors.apellido ? (
                <p className="text-xs text-destructive">{errors.apellido}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                ref={(el) => {
                  fieldRefs.current.dni = el;
                }}
                inputMode="numeric"
                value={form.dni}
                onChange={(e) =>
                  updateField("dni", e.target.value.replace(/[^\d]/g, ""))
                }
                disabled={readOnly}
                className={fieldClass(Boolean(errors.dni))}
              />
              {errors.dni ? <p className="text-xs text-destructive">{errors.dni}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
              <Input
                id="fecha_nacimiento"
                ref={(el) => {
                  fieldRefs.current.fecha_nacimiento = el;
                }}
                placeholder="dd/mm/yyyy"
                value={form.fecha_nacimiento}
                onChange={(e) =>
                  updateField("fecha_nacimiento", maskFechaNacimiento(e.target.value))
                }
                disabled={readOnly}
                maxLength={10}
                className={fieldClass(Boolean(errors.fecha_nacimiento))}
              />
              {errors.fecha_nacimiento ? (
                <p className="text-xs text-destructive">{errors.fecha_nacimiento}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <select
                id="sexo"
                ref={(el) => {
                  fieldRefs.current.sexo = el;
                }}
                value={form.sexo}
                onChange={(e) =>
                  updateField("sexo", e.target.value as FormState["sexo"])
                }
                disabled={readOnly}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${fieldClass(Boolean(errors.sexo))}`}
              >
                <option value="">Seleccionar…</option>
                <option value="M">M - Masculino</option>
                <option value="F">F - Femenino</option>
                <option value="X">X</option>
              </select>
              {errors.sexo ? (
                <p className="text-xs text-destructive">{errors.sexo}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="celular">Celular</Label>
              <Input
                id="celular"
                ref={(el) => {
                  fieldRefs.current.celular = el;
                }}
                value={form.celular}
                onChange={(e) =>
                  updateField("celular", e.target.value.replace(/[^\d\s-]/g, ""))
                }
                disabled={readOnly}
                className={fieldClass(Boolean(errors.celular))}
              />
              {errors.celular ? (
                <p className="text-xs text-destructive">{errors.celular}</p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mail">Email (opcional)</Label>
              <Input
                id="mail"
                ref={(el) => {
                  fieldRefs.current.mail = el;
                }}
                type="email"
                value={form.mail}
                onChange={(e) => updateField("mail", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.mail))}
              />
              {errors.mail ? (
                <p className="text-xs text-destructive">{errors.mail}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Domicilio
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <select
                id="pais"
                ref={(el) => {
                  fieldRefs.current.pais = el;
                }}
                value={form.pais}
                onChange={(e) => updateField("pais", e.target.value)}
                disabled={readOnly}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Argentina">Argentina</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <select
                id="provincia"
                ref={(el) => {
                  fieldRefs.current.provincia = el;
                }}
                value={form.provincia}
                onChange={(e) => updateField("provincia", e.target.value)}
                disabled={readOnly}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Buenos Aires">Buenos Aires</option>
                <option value="Santa Fe">Santa Fe</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                ref={(el) => {
                  fieldRefs.current.ciudad = el;
                }}
                value={form.ciudad}
                onChange={(e) => updateField("ciudad", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.ciudad))}
              />
              {errors.ciudad ? (
                <p className="text-xs text-destructive">{errors.ciudad}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cp">Código postal</Label>
              <Input
                id="cp"
                ref={(el) => {
                  fieldRefs.current.cp = el;
                }}
                inputMode="numeric"
                value={form.cp}
                onChange={(e) =>
                  updateField("cp", e.target.value.replace(/[^\d]/g, ""))
                }
                disabled={readOnly}
                className={fieldClass(Boolean(errors.cp))}
              />
              {errors.cp ? <p className="text-xs text-destructive">{errors.cp}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="calle">Calle</Label>
              <Input
                id="calle"
                ref={(el) => {
                  fieldRefs.current.calle = el;
                }}
                value={form.calle}
                onChange={(e) => updateField("calle", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.calle))}
              />
              {errors.calle ? (
                <p className="text-xs text-destructive">{errors.calle}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="altura">Altura</Label>
              <Input
                id="altura"
                ref={(el) => {
                  fieldRefs.current.altura = el;
                }}
                value={form.altura}
                onChange={(e) => updateField("altura", e.target.value)}
                disabled={readOnly}
                className={fieldClass(Boolean(errors.altura))}
              />
              {errors.altura ? (
                <p className="text-xs text-destructive">{errors.altura}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento (opcional)</Label>
              <Input
                id="departamento"
                value={form.departamento}
                onChange={(e) => updateField("departamento", e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea
                id="notas"
                value={form.notas}
                onChange={(e) => updateField("notas", e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de la cuenta
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de usuario</Label>
              <Input
                id="username"
                value={usernamePreview ? `@${usernamePreview}` : ""}
                readOnly
                disabled
                placeholder="Se genera automáticamente"
              />
              <p className="text-xs text-muted-foreground">
                Se genera con la primera letra del nombre + apellido (sin espacios).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol_id">Rol</Label>
              <select
                id="rol_id"
                ref={(el) => {
                  fieldRefs.current.rol_id = el;
                }}
                value={form.rol_id}
                onChange={(e) => updateField("rol_id", e.target.value)}
                disabled={readOnly || isLoadingRoles}
                className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${fieldClass(Boolean(errors.rol_id))}`}
              >
                <option value="">
                  {isLoadingRoles ? "Cargando roles…" : "Seleccionar…"}
                </option>
                {roles.map((rol) => (
                  <option key={rol.id} value={String(rol.id)}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
              {errors.rol_id ? (
                <p className="text-xs text-destructive">{errors.rol_id}</p>
              ) : null}
              {rolesError ? (
                <p className="text-xs text-destructive">{rolesError}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="habilitado"
                checked={form.habilitado}
                onCheckedChange={(checked) =>
                  updateField("habilitado", checked === true)
                }
                disabled={readOnly}
              />
              <Label htmlFor="habilitado">Usuario habilitado</Label>
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
          {!readOnly ? (
            <Button type="submit" disabled={isSubmitting || isLoadingRoles}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          ) : null}
        </div>
      </form>

      <Dialog
        open={success !== null}
        onOpenChange={(open) => {
          if (!open && success) {
            navigate("/admin/usuarios");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado correctamente</DialogTitle>
            <DialogDescription>
              El alta se completó con éxito. El usuario{" "}
              <span className="font-medium text-foreground">@{success?.username}</span>{" "}
              deberá cambiar su contraseña al ingresar.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contraseña temporal
            </p>
            <p className="mt-1 font-mono text-lg tracking-wide">
              {success?.password_temporal}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => navigate("/admin/usuarios")}>
              Ir al listado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
