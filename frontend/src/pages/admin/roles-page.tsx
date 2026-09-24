import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  KeyRound,
  Loader2,
  Lock,
  Plus,
  Save,
  Search,
  ShieldOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import type {
  PermisoGroup,
  PermisoItem,
  RolCreatePayload,
  RolDetail,
  RolListItem,
} from "@/types/roles";

const WILDCARD_PERMISSION = "*";

export function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

export function isAdminRoleName(nombre: string): boolean {
  return nombre.toLowerCase() === "admin";
}

export function dominioDePermiso(nombre: string): string {
  if (nombre === WILDCARD_PERMISSION) {
    return "sistema";
  }
  const idx = nombre.indexOf(":");
  return idx > 0 ? nombre.slice(0, idx) : nombre;
}

export function groupPermisos(permisos: PermisoItem[]): PermisoGroup[] {
  const map = new Map<string, PermisoItem[]>();
  for (const permiso of permisos) {
    const dominio = dominioDePermiso(permiso.nombre);
    const list = map.get(dominio) ?? [];
    list.push(permiso);
    map.set(dominio, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([dominio, items]) => ({
      dominio,
      permisos: [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    }));
}

export function filterPermisosCatalogo(
  permisos: PermisoItem[],
  query: string,
  excludeWildcard: boolean,
): PermisoItem[] {
  const q = query.trim().toLowerCase();
  return permisos.filter((permiso) => {
    if (excludeWildcard && permiso.nombre === WILDCARD_PERMISSION) {
      return false;
    }
    if (!q) {
      return true;
    }
    const haystack = `${permiso.nombre} ${permiso.descripcion ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
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
          No tenés permiso para ver roles y permisos.
        </p>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <div className="relative w-full">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full appearance-none rounded-md border border-input bg-transparent py-0 pl-2.5 pr-8 text-sm font-medium ${className ?? ""}`}
      >
        {children}
      </select>
    </div>
  );
}

export default function RolesPage() {
  const { permisos } = useAuth();
  const canView = hasPermission(permisos, "roles:ver");
  const canCreate = hasPermission(permisos, "roles:crear");
  const canEdit = hasPermission(permisos, "roles:editar");

  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [roles, setRoles] = React.useState<RolListItem[]>([]);
  const [catalogo, setCatalogo] = React.useState<PermisoItem[]>([]);
  const [detalle, setDetalle] = React.useState<RolDetail | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [baselineIds, setBaselineIds] = React.useState<Set<number>>(new Set());

  const [isLoadingNav, setIsLoadingNav] = React.useState(true);
  const [isLoadingDetalle, setIsLoadingDetalle] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [detalleError, setDetalleError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [nuevoNombre, setNuevoNombre] = React.useState("");
  const [nuevaDescripcion, setNuevaDescripcion] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [nombreFieldError, setNombreFieldError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const nombreInputRef = React.useRef<HTMLInputElement>(null);

  const [pendingRolId, setPendingRolId] = React.useState<number | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  const selectedRolId = React.useMemo(() => {
    if (!routeId) {
      return null;
    }
    const parsed = Number(routeId);
    return Number.isFinite(parsed) ? parsed : null;
  }, [routeId]);

  const selectedRol = React.useMemo(
    () => roles.find((rol) => rol.id === selectedRolId) ?? null,
    [roles, selectedRolId],
  );

  const isAdminSelected = Boolean(
    detalle?.es_admin || (selectedRol && isAdminRoleName(selectedRol.nombre)),
  );
  const matrixReadOnly = isAdminSelected || !canEdit;
  const hasUnsavedChanges =
    !isAdminSelected && canEdit && !setsEqual(selectedIds, baselineIds);

  const visiblePermisos = React.useMemo(
    () => filterPermisosCatalogo(catalogo, search, !isAdminSelected),
    [catalogo, search, isAdminSelected],
  );
  const grouped = React.useMemo(() => groupPermisos(visiblePermisos), [visiblePermisos]);

  const loadRolesAndCatalogo = React.useCallback(async () => {
    setIsLoadingNav(true);
    setErrorMessage(null);
    try {
      const [rolesData, permisosData] = await Promise.all([
        apiFetch<RolListItem[]>("/api/roles"),
        apiFetch<PermisoItem[]>("/api/permisos"),
      ]);
      setRoles(rolesData);
      setCatalogo(permisosData);
      return rolesData;
    } catch {
      setErrorMessage("No se pudieron cargar los roles o el catálogo de permisos.");
      setRoles([]);
      setCatalogo([]);
      return [] as RolListItem[];
    } finally {
      setIsLoadingNav(false);
    }
  }, []);

  const applyDetalle = React.useCallback((data: RolDetail) => {
    setDetalle(data);
    const ids = new Set(data.permisos.map((permiso) => permiso.id));
    if (data.es_admin || data.acceso_total) {
      // UI: todos checked (visual); baseline vacío de edición.
      setSelectedIds(new Set());
      setBaselineIds(new Set());
    } else {
      setSelectedIds(ids);
      setBaselineIds(new Set(ids));
    }
  }, []);

  const loadDetalle = React.useCallback(
    async (rolId: number) => {
      setIsLoadingDetalle(true);
      setDetalleError(null);
      try {
        const data = await apiFetch<RolDetail>(`/api/roles/${rolId}`);
        applyDetalle(data);
      } catch {
        setDetalle(null);
        setSelectedIds(new Set());
        setBaselineIds(new Set());
        setDetalleError("No se pudo cargar el detalle del rol.");
      } finally {
        setIsLoadingDetalle(false);
      }
    },
    [applyDetalle],
  );

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void (async () => {
      const rolesData = await loadRolesAndCatalogo();
      if (rolesData.length === 0) {
        return;
      }
      const pathId = routeId ? Number(routeId) : null;
      const hasValid =
        pathId != null && Number.isFinite(pathId) && rolesData.some((rol) => rol.id === pathId);
      if (!hasValid) {
        navigate(`/admin/roles/${rolesData[0].id}`, { replace: true });
      }
    })();
    // Solo bootstrap inicial / cuando cambia la capacidad de ver.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- routeId se lee al montar/rehidratar
  }, [canView, loadRolesAndCatalogo, navigate]);

  React.useEffect(() => {
    if (!canView || selectedRolId == null) {
      return;
    }
    if (roles.length > 0 && !roles.some((rol) => rol.id === selectedRolId)) {
      setDetalleError("No se encontró el rol solicitado.");
      setDetalle(null);
      return;
    }
    void loadDetalle(selectedRolId);
  }, [canView, loadDetalle, roles, selectedRolId]);

  const requestSelectRol = (rolId: number) => {
    if (rolId === selectedRolId) {
      return;
    }
    if (hasUnsavedChanges) {
      setPendingRolId(rolId);
      setDiscardOpen(true);
      return;
    }
    setSearch("");
    navigate(`/admin/roles/${rolId}`);
  };

  const confirmDiscard = () => {
    if (pendingRolId != null) {
      setSearch("");
      navigate(`/admin/roles/${pendingRolId}`);
    }
    setPendingRolId(null);
    setDiscardOpen(false);
  };

  const togglePermiso = (permisoId: number, checked: boolean) => {
    if (matrixReadOnly) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(permisoId);
      } else {
        next.delete(permisoId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedRolId || matrixReadOnly || !hasUnsavedChanges) {
      return;
    }
    setIsSaving(true);
    setDetalleError(null);
    setSuccessMessage(null);
    try {
      const data = await apiFetch<RolDetail>(`/api/roles/${selectedRolId}/permisos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permiso_ids: Array.from(selectedIds) }),
      });
      applyDetalle(data);
      setSuccessMessage("Permisos actualizados correctamente.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudieron guardar los permisos.";
      setDetalleError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const openCreate = () => {
    setNuevoNombre("");
    setNuevaDescripcion("");
    setCreateError(null);
    setNombreFieldError(null);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) {
      setNombreFieldError("El nombre es obligatorio.");
      nombreInputRef.current?.focus();
      return;
    }
    setNombreFieldError(null);
    setCreateError(null);
    setIsCreating(true);
    try {
      const payload: RolCreatePayload = {
        nombre,
        descripcion: nuevaDescripcion.trim() ? nuevaDescripcion.trim() : null,
      };
      const created = await apiFetch<RolDetail>("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCreateOpen(false);
      setSuccessMessage(`Rol «${created.nombre}» creado.`);
      const rolesData = await loadRolesAndCatalogo();
      const exists = rolesData.some((rol) => rol.id === created.id);
      if (!exists) {
        setRoles((prev) =>
          [...prev, { id: created.id, nombre: created.nombre }].sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es"),
          ),
        );
      }
      navigate(`/admin/roles/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear el rol.";
      setCreateError(message);
      if (message.toLowerCase().includes("nombre")) {
        nombreInputRef.current?.focus();
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <KeyRound className="size-4" />
          Admin
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Roles y Permisos</h1>
        <p className="text-sm text-muted-foreground">
          Asignación de permisos a cada rol del sistema.
        </p>
      </div>

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

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <div className="lg:hidden">
          {isLoadingNav ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <FilterSelect
              aria-label="Rol"
              value={selectedRolId != null ? String(selectedRolId) : ""}
              onChange={(value) => requestSelectRol(Number(value))}
            >
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                  {isAdminRoleName(rol.nombre) ? " (solo lectura)" : ""}
                </option>
              ))}
            </FilterSelect>
          )}
        </div>

        <aside className="hidden lg:row-span-2 lg:block">
          <nav className="space-y-1 rounded-2xl border bg-card p-2 shadow-sm">
            {isLoadingNav
              ? Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-9 w-full" />
                ))
              : roles.map((rol) => {
                  const active = rol.id === selectedRolId;
                  const admin = isAdminRoleName(rol.nombre);
                  return (
                    <button
                      key={rol.id}
                      type="button"
                      onClick={() => requestSelectRol(rol.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <span>{rol.nombre}</span>
                      {admin ? (
                        <Lock
                          className={`size-3.5 shrink-0 ${active ? "opacity-90" : "text-muted-foreground"}`}
                        />
                      ) : null}
                    </button>
                  );
                })}
            {!isLoadingNav && roles.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No hay roles cargados.
              </p>
            ) : null}
          </nav>
        </aside>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar permiso…"
              className="pl-9"
              aria-label="Buscar permiso"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canEdit && !isAdminSelected ? (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!hasUnsavedChanges || isSaving || isLoadingDetalle}
              >
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Guardar
              </Button>
            ) : null}
            {canCreate ? (
              <Button type="button" variant="outline" onClick={openCreate}>
                <Plus className="size-4" />
                Nuevo Rol
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          {isLoadingDetalle || isLoadingNav ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ) : detalleError ? (
            <p className="text-sm text-destructive">{detalleError}</p>
          ) : selectedRolId == null || roles.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">No hay roles cargados.</p>
              {canCreate ? (
                <Button type="button" onClick={openCreate}>
                  <Plus className="size-4" />
                  Nuevo Rol
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {detalle?.nombre ?? selectedRol?.nombre ?? "Rol"}
                </h2>
                {isAdminSelected ? (
                  <>
                    <Badge className="border-transparent bg-muted text-muted-foreground hover:bg-muted">
                      Solo lectura
                    </Badge>
                    <Badge className="border-transparent bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300">
                      Acceso total
                    </Badge>
                  </>
                ) : null}
              </div>
              {isAdminSelected ? (
                <p className="text-sm text-muted-foreground">
                  El rol ADMIN tiene acceso total al sistema (comodín{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">*</code>) y no se
                  puede modificar desde esta pantalla.
                </p>
              ) : detalle?.descripcion ? (
                <p className="text-sm text-muted-foreground">{detalle.descripcion}</p>
              ) : null}

              {grouped.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay permisos para mostrar con el filtro actual.
                </p>
              ) : (
                grouped.map((group) => (
                  <section key={group.dominio} className="space-y-3">
                    <h3 className="text-sm font-semibold capitalize tracking-tight">
                      {group.dominio}
                    </h3>
                    <ul className="space-y-2">
                      {group.permisos.map((permiso) => {
                        const checked = isAdminSelected
                          ? true
                          : selectedIds.has(permiso.id);
                        return (
                          <li
                            key={permiso.id}
                            className="flex items-start gap-3 rounded-xl border border-transparent px-2 py-1.5 hover:border-border hover:bg-muted/40"
                          >
                            <Checkbox
                              id={`permiso-${permiso.id}`}
                              checked={checked}
                              disabled={matrixReadOnly}
                              onCheckedChange={(value) =>
                                togglePermiso(permiso.id, value === true)
                              }
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`permiso-${permiso.id}`}
                              className={`min-w-0 flex-1 space-y-0.5 ${matrixReadOnly ? "cursor-default" : "cursor-pointer"}`}
                            >
                              <div className="text-sm font-medium leading-none">
                                {permiso.nombre}
                              </div>
                              {permiso.descripcion ? (
                                <p className="text-xs text-muted-foreground">
                                  {permiso.descripcion}
                                </p>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo rol</DialogTitle>
            <DialogDescription>
              El rol se crea sin permisos. Después podés asignarlos en la matriz.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rol-nombre">Nombre</Label>
              <Input
                id="rol-nombre"
                ref={nombreInputRef}
                value={nuevoNombre}
                onChange={(event) => setNuevoNombre(event.target.value)}
                maxLength={50}
                className={nombreFieldError ? "border-destructive" : undefined}
                aria-invalid={Boolean(nombreFieldError)}
              />
              {nombreFieldError ? (
                <p className="text-sm text-destructive">{nombreFieldError}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rol-descripcion">Descripción</Label>
              <Input
                id="rol-descripcion"
                value={nuevaDescripcion}
                onChange={(event) => setNuevaDescripcion(event.target.value)}
                maxLength={255}
              />
            </div>
            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={isCreating}>
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : null}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambios sin guardar</DialogTitle>
            <DialogDescription>
              Hay cambios sin guardar. ¿Descartarlos y cambiar de rol?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingRolId(null);
                setDiscardOpen(false);
              }}
            >
              Seguir editando
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDiscard}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
