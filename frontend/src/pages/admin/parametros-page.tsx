import React from "react";
import { Loader2, Save, ShieldOff, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import type { ConfigGroup, ConfigItem } from "@/types/config";

const INTEGER_PARAMETROS = new Set([
  "ACCESS_TOKEN_EXPIRACION",
  "REFRESH_TOKEN_EXPIRACION",
  "PERSONA_ID_TUTOR_EVENTUAL",
]);

export function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

export function validateParametroValor(
  parametroNombre: string,
  rawValor: string,
): string | null {
  const valor = rawValor.trim();
  if (!valor) {
    return "El valor no puede estar vacío.";
  }
  if (valor.length > 255) {
    return "El valor no puede superar 255 caracteres.";
  }
  if (INTEGER_PARAMETROS.has(parametroNombre)) {
    if (!/^\d+$/.test(valor)) {
      return "Debe ser un entero positivo.";
    }
    const numero = Number.parseInt(valor, 10);
    if (!Number.isFinite(numero) || numero < 1) {
      return "Debe ser un entero >= 1.";
    }
  }
  return null;
}

export function groupConfigs(items: ConfigItem[]): ConfigGroup[] {
  const map = new Map<string, ConfigItem[]>();
  for (const item of items) {
    const list = map.get(item.config_nombre) ?? [];
    list.push(item);
    map.set(item.config_nombre, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([config_nombre, groupItems]) => ({
      config_nombre,
      items: [...groupItems].sort((a, b) => {
        if (a.parametro_id !== b.parametro_id) {
          return a.parametro_id - b.parametro_id;
        }
        return a.parametro_nombre.localeCompare(b.parametro_nombre, "es");
      }),
    }));
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
          No tenés permiso para ver los parámetros del sistema.
        </p>
      </div>
    </div>
  );
}

export default function ParametrosPage() {
  const { permisos } = useAuth();
  const canView = hasPermission(permisos, "parametros:ver");
  const canEdit = hasPermission(permisos, "parametros:editar");

  const [items, setItems] = React.useState<ConfigItem[]>([]);
  const [baseline, setBaseline] = React.useState<Record<number, string>>({});
  const [drafts, setDrafts] = React.useState<Record<number, string>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<number, string>>({});

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const groups = React.useMemo(() => groupConfigs(items), [items]);

  const dirtyIds = React.useMemo(() => {
    return items
      .filter((item) => (drafts[item.id] ?? item.parametro_valor) !== baseline[item.id])
      .map((item) => item.id);
  }, [baseline, drafts, items]);

  const hasUnsavedChanges = dirtyIds.length > 0;

  const loadItems = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await apiFetch<ConfigItem[]>("/api/config");
      setItems(data);
      const nextBaseline: Record<number, string> = {};
      const nextDrafts: Record<number, string> = {};
      for (const item of data) {
        nextBaseline[item.id] = item.parametro_valor;
        nextDrafts[item.id] = item.parametro_valor;
      }
      setBaseline(nextBaseline);
      setDrafts(nextDrafts);
      setFieldErrors({});
    } catch {
      setErrorMessage("No se pudieron cargar los parámetros.");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void loadItems();
  }, [canView, loadItems]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const setDraftValue = (id: number, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: value }));
    setFieldErrors((prev) => {
      if (!(id in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    if (!canEdit || dirtyIds.length === 0) {
      return;
    }

    const nextErrors: Record<number, string> = {};
    const dirtyItems = items.filter((item) => dirtyIds.includes(item.id));
    for (const item of dirtyItems) {
      const error = validateParametroValor(
        item.parametro_nombre,
        drafts[item.id] ?? item.parametro_valor,
      );
      if (error) {
        nextErrors[item.id] = error;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const firstId = Number(Object.keys(nextErrors)[0]);
      document.getElementById(`parametro-${firstId}`)?.focus();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const savedBaseline = { ...baseline };
    const savedDrafts = { ...drafts };
    const savedItems = [...items];

    try {
      for (const item of dirtyItems) {
        const raw = drafts[item.id] ?? item.parametro_valor;
        const updated = await apiFetch<ConfigItem>(`/api/config/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parametro_valor: raw }),
        });
        savedBaseline[item.id] = updated.parametro_valor;
        savedDrafts[item.id] = updated.parametro_valor;
        const idx = savedItems.findIndex((row) => row.id === item.id);
        if (idx >= 0) {
          savedItems[idx] = updated;
        }
      }
      setBaseline(savedBaseline);
      setDrafts(savedDrafts);
      setItems(savedItems);
      setFieldErrors({});
      setSuccessMessage("Parámetros actualizados.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudieron guardar los parámetros.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Admin
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Parámetros</h1>
          <p className="text-sm text-muted-foreground">
            Configuración global del sistema (sys.config).
          </p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!hasUnsavedChanges || isSaving || isLoading}
            className="shrink-0"
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Guardar cambios
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">
        Solo se puede editar el valor de cada parámetro.
      </p>

      {successMessage ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
          {successMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
          No hay parámetros cargados en sys.config.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section
              key={group.config_nombre}
              className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm"
            >
              <h2 className="text-lg font-semibold tracking-tight">{group.config_nombre}</h2>
              <div className="space-y-4">
                {group.items.map((item) => {
                  const value = drafts[item.id] ?? item.parametro_valor;
                  const error = fieldErrors[item.id];
                  return (
                    <div key={item.id} className="space-y-2">
                      <Label htmlFor={`parametro-${item.id}`}>{item.parametro_nombre}</Label>
                      <Input
                        id={`parametro-${item.id}`}
                        value={value}
                        onChange={(event) => setDraftValue(item.id, event.target.value)}
                        disabled={!canEdit || isSaving}
                        readOnly={!canEdit}
                        maxLength={255}
                        className={error ? "border-destructive" : undefined}
                        aria-invalid={Boolean(error)}
                      />
                      {error ? <p className="text-sm text-destructive">{error}</p> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
