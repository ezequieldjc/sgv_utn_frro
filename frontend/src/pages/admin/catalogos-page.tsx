import React from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldOff,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import {
  CATALOGO_NAV,
  type CatalogoItem,
  type CatalogoNavItem,
  type CatalogoSlug,
  type EspecieOpcion,
} from "@/types/catalogos";

type ActivoFilter = "true" | "false" | "all";
type SortKey = "nombre" | "especie" | "estado";
type SortDir = "asc" | "desc";

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function resolveNav(slug: string | null): CatalogoNavItem {
  return CATALOGO_NAV.find((item) => item.slug === slug) ?? CATALOGO_NAV[0];
}

function compareItems(a: CatalogoItem, b: CatalogoItem, key: SortKey): number {
  switch (key) {
    case "nombre":
      return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase(), "es");
    case "especie":
      return (a.especie_nombre ?? "")
        .toLowerCase()
        .localeCompare((b.especie_nombre ?? "").toLowerCase(), "es");
    case "estado":
      return Number(a.activo) - Number(b.activo);
    default:
      return 0;
  }
}

function activoFilterClassName(filter: ActivoFilter): string {
  if (filter === "true") {
    return "text-green-800 dark:text-green-300";
  }
  if (filter === "false") {
    return "text-destructive";
  }
  return "text-foreground";
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
    <div className="relative w-auto shrink-0">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 appearance-none rounded-md border border-input bg-transparent py-0 pl-2.5 pr-8 text-sm font-medium ${className ?? ""}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  if (activo) {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300">
        Activo
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10">
      Inactivo
    </Badge>
  );
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
          No tenés permiso para ver los catálogos.
        </p>
      </div>
    </div>
  );
}

function SortableHead({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (
          activeDir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground" />
        )}
      </button>
    </TableHead>
  );
}

export default function CatalogosPage() {
  const { permisos } = useAuth();
  const canView = hasPermission(permisos, "catalogos:ver");
  const canCreate = hasPermission(permisos, "catalogos:crear");
  const canEdit = hasPermission(permisos, "catalogos:editar");
  const canDelete = hasPermission(permisos, "catalogos:eliminar");

  const [searchParams, setSearchParams] = useSearchParams();
  const selected = resolveNav(searchParams.get("tipo"));

  const [items, setItems] = React.useState<CatalogoItem[]>([]);
  const [especies, setEspecies] = React.useState<EspecieOpcion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [activoFilter, setActivoFilter] = React.useState<ActivoFilter>("true");
  const [especieFilter, setEspecieFilter] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("nombre");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CatalogoItem | null>(null);
  const [nombre, setNombre] = React.useState("");
  const [descripcion, setDescripcion] = React.useState("");
  const [especieId, setEspecieId] = React.useState<string>("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const [confirmItem, setConfirmItem] = React.useState<CatalogoItem | null>(null);
  const [confirmNextActivo, setConfirmNextActivo] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);

  const selectCatalogo = React.useCallback(
    (slug: CatalogoSlug) => {
      setSearchParams({ tipo: slug });
      setSearch("");
      setDebouncedSearch("");
    },
    [setSearchParams],
  );

  const loadEspecies = React.useCallback(async () => {
    const data = await apiFetch<EspecieOpcion[]>("/api/catalogos/especies-opciones");
    setEspecies(data);
  }, []);

  const loadItems = React.useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.set("activo", activoFilter);
      if (debouncedSearch.trim()) {
        params.set("q", debouncedSearch.trim());
      }
      if (selected.requiereEspecie && especieFilter) {
        params.set("especie_id", especieFilter);
      }
      const data = await apiFetch<CatalogoItem[]>(
        `${selected.apiPath}?${params.toString()}`,
      );
      setItems(data);
    } catch {
      setErrorMessage("No se pudieron cargar los registros del catálogo.");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activoFilter, debouncedSearch, especieFilter, selected]);

  React.useEffect(() => {
    if (!searchParams.get("tipo")) {
      setSearchParams({ tipo: CATALOGO_NAV[0].slug }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void loadEspecies();
  }, [canView, loadEspecies]);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void loadItems();
  }, [canView, loadItems]);

  if (!canView) {
    return <AccessDenied />;
  }

  const sortedItems = [...items].sort((a, b) => {
    const cmp = compareItems(a, b, sortKey);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function openCreate() {
    setEditing(null);
    setNombre("");
    setDescripcion("");
    setEspecieId("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: CatalogoItem) {
    setEditing(item);
    setNombre(item.nombre);
    setDescripcion(item.descripcion ?? "");
    setEspecieId(item.especie_id != null ? String(item.especie_id) : "");
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    const trimmedNombre = nombre.trim();
    if (!trimmedNombre) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    if (selected.requiereEspecie && !especieId) {
      setFormError("Seleccioná una especie.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload = selected.requiereEspecie
        ? {
            nombre: trimmedNombre,
            descripcion: descripcion.trim() ? descripcion.trim() : null,
            especie_id: Number(especieId),
          }
        : {
            nombre: trimmedNombre,
            descripcion: descripcion.trim() ? descripcion.trim() : null,
          };

      if (editing) {
        await apiFetch<CatalogoItem>(`${selected.apiPath}/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<CatalogoItem>(selected.apiPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setFormOpen(false);
      await loadItems();
    } catch {
      setFormError("No se pudo guardar el registro. Intentá de nuevo.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmToggleActivo() {
    if (!confirmItem || isToggling) {
      return;
    }
    setIsToggling(true);
    try {
      await apiFetch<CatalogoItem>(`${selected.apiPath}/${confirmItem.id}/activo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: confirmNextActivo }),
      });
      setConfirmItem(null);
      await loadItems();
    } catch {
      setErrorMessage("No se pudo actualizar el estado del registro.");
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Admin</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogos</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros clínicos usados en altas de mascota y demás módulos.
        </p>
      </div>

      <div className="grid items-start gap-x-6 gap-y-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
        <aside className="hidden lg:row-span-2 lg:block">
          <nav className="space-y-1 rounded-2xl border bg-card p-2 shadow-sm">
            {CATALOGO_NAV.map((item) => {
              const active = item.slug === selected.slug;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => selectCatalogo(item.slug)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="lg:col-start-2 lg:row-start-1">
          <div className="mb-4 lg:hidden">
            <Label htmlFor="catalogo-mobile">Catálogo</Label>
            <select
              id="catalogo-mobile"
              className="mt-1 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={selected.slug}
              onChange={(event) => selectCatalogo(event.target.value as CatalogoSlug)}
            >
              {CATALOGO_NAV.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full flex-col gap-3 sm:max-w-2xl sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre..."
                  className="h-10 bg-background pl-9"
                />
              </div>
              <FilterSelect
                aria-label="Filtrar por estado"
                value={activoFilter}
                onChange={(value) => setActivoFilter(value as ActivoFilter)}
                className={activoFilterClassName(activoFilter)}
              >
                <option value="true" className="text-green-800">
                  Activos
                </option>
                <option value="false" className="text-destructive">
                  Inactivos
                </option>
                <option value="all" className="text-foreground">
                  Todos
                </option>
              </FilterSelect>
              {selected.requiereEspecie ? (
                <FilterSelect
                  aria-label="Filtrar por especie"
                  value={especieFilter}
                  onChange={setEspecieFilter}
                  className="max-w-[14rem]"
                >
                  <option value="">Todas las especies</option>
                  {especies.map((especie) => (
                    <option key={especie.id} value={String(especie.id)}>
                      {especie.nombre}
                      {especie.activo ? "" : " (inactiva)"}
                    </option>
                  ))}
                </FilterSelect>
              ) : null}
            </div>

            {canCreate ? (
              <Button type="button" className="shrink-0" onClick={openCreate}>
                <Plus className="size-4" />
                Nuevo {selected.singularLabel}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 lg:col-start-2 lg:row-start-2">
          {errorMessage ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Nombre"
                      sortKey="nombre"
                      activeKey={sortKey}
                      activeDir={sortDir}
                      onSort={handleSort}
                    />
                    {selected.requiereEspecie ? (
                      <SortableHead
                        label="Especie"
                        sortKey="especie"
                        activeKey={sortKey}
                        activeDir={sortDir}
                        onSort={handleSort}
                      />
                    ) : null}
                    <TableHead>Descripción</TableHead>
                    <SortableHead
                      label="Estado"
                      sortKey="estado"
                      activeKey={sortKey}
                      activeDir={sortDir}
                      onSort={handleSort}
                    />
                    <TableHead className="text-left">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={selected.requiereEspecie ? 5 : 4}
                        className="h-28 text-center text-sm text-muted-foreground"
                      >
                        No hay registros para este catálogo con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{item.nombre}</TableCell>
                        {selected.requiereEspecie ? (
                          <TableCell className="text-muted-foreground">
                            {item.especie_nombre ?? "-"}
                          </TableCell>
                        ) : null}
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {item.descripcion ?? "-"}
                        </TableCell>
                        <TableCell>
                          <EstadoBadge activo={item.activo} />
                        </TableCell>
                        <TableCell className="text-left">
                          <TooltipProvider>
                            <div className="flex items-center justify-start gap-1">
                              {canEdit ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEdit(item)}
                                    >
                                      <Pencil className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                              ) : null}

                              {item.activo && canDelete ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setConfirmItem(item);
                                        setConfirmNextActivo(false);
                                      }}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Dar de baja</TooltipContent>
                                </Tooltip>
                              ) : null}

                              {!item.activo && canEdit ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setConfirmItem(item);
                                        setConfirmNextActivo(true);
                                      }}
                                    >
                                      <RotateCcw className="size-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Reactivar</TooltipContent>
                                </Tooltip>
                              ) : null}
                            </div>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={(event) => void submitForm(event)}>
            <DialogHeader>
              <DialogTitle>
                {editing
                  ? `Editar ${selected.singularLabel}`
                  : `Nuevo ${selected.singularLabel}`}
              </DialogTitle>
              <DialogDescription>
                Completá los datos del registro de {selected.label.toLowerCase()}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="cat-nombre">Nombre</Label>
                <Input
                  id="cat-nombre"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  maxLength={50}
                />
              </div>
              {selected.requiereEspecie ? (
                <div className="space-y-2">
                  <Label htmlFor="cat-especie">Especie</Label>
                  <select
                    id="cat-especie"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={especieId}
                    onChange={(event) => setEspecieId(event.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {especies.map((especie) => (
                      <option key={especie.id} value={String(especie.id)}>
                        {especie.nombre}
                        {especie.activo ? "" : " (inactiva)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Descripción (opcional)</Label>
                <Input
                  id="cat-desc"
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  maxLength={255}
                />
              </div>
              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmItem(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmNextActivo ? "Reactivar registro" : "Dar de baja"}
            </DialogTitle>
            <DialogDescription>
              {confirmNextActivo
                ? `¿Reactivar «${confirmItem?.nombre}»?`
                : `¿Dar de baja «${confirmItem?.nombre}»? El registro no se elimina físicamente.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmItem(null)}
              disabled={isToggling}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmToggleActivo()}
              disabled={isToggling}
            >
              {isToggling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Procesando…
                </>
              ) : (
                "Confirmar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
