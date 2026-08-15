import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Eye,
  KeyRound,
  Plus,
  Search,
  ShieldOff,
  UserCheck,
  UserX,
  Users,
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
import type { UsuarioListItem } from "@/types/usuarios";

type SortKey = "nombre" | "username" | "ultimo_inicio" | "estado" | "rol";
type SortDir = "asc" | "desc";

interface HabilitadoConfirmState {
  usuario: UsuarioListItem;
  nextHabilitado: boolean;
}

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function formatUltimoInicio(value: string | null): string {
  if (!value) {
    return "Nunca";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Nunca";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes} hs`;
}

function matchesSearch(usuario: UsuarioListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const fullName = `${usuario.nombre} ${usuario.apellido}`.toLowerCase();
  return fullName.includes(normalized) || usuario.username.toLowerCase().includes(normalized);
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === null && b === null) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return new Date(a).getTime() - new Date(b).getTime();
}

function compareUsuarios(a: UsuarioListItem, b: UsuarioListItem, sortKey: SortKey): number {
  switch (sortKey) {
    case "nombre": {
      const nameA = `${a.apellido} ${a.nombre}`.toLowerCase();
      const nameB = `${b.apellido} ${b.nombre}`.toLowerCase();
      return nameA.localeCompare(nameB, "es");
    }
    case "username":
      return a.username.toLowerCase().localeCompare(b.username.toLowerCase(), "es");
    case "ultimo_inicio":
      return compareNullableDate(a.ultimo_inicio_sesion, b.ultimo_inicio_sesion);
    case "estado":
      return Number(a.habilitado) - Number(b.habilitado);
    case "rol":
      return a.rol_nombre.toLowerCase().localeCompare(b.rol_nombre.toLowerCase(), "es");
    default:
      return 0;
  }
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
          No tenés permiso para ver la gestión de usuarios.
        </p>
      </div>
    </div>
  );
}

function ActionIconButton({
  label,
  onClick,
  to,
  children,
}: {
  label: string;
  onClick?: () => void;
  to?: string;
  children: React.ReactNode;
}) {
  const button = to ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-foreground"
      aria-label={label}
      asChild
    >
      <Link to={to}>{children}</Link>
    </Button>
  ) : (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground hover:text-foreground"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
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
  const isActive = activeKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : activeDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon
          className={`size-3.5 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
        />
      </button>
    </TableHead>
  );
}

function UsuariosTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function UsuariosPage() {
  const { permisos } = useAuth();
  const [usuarios, setUsuarios] = React.useState<UsuarioListItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("nombre");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [confirmState, setConfirmState] = React.useState<HabilitadoConfirmState | null>(
    null
  );
  const [isUpdatingHabilitado, setIsUpdatingHabilitado] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  const canView = hasPermission(permisos, "usuarios:ver");
  const canCreate = hasPermission(permisos, "usuarios:crear");
  const canEdit = hasPermission(permisos, "usuarios:editar");

  React.useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadUsuarios() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await apiFetch<UsuarioListItem[]>("/api/usuarios");
        if (!cancelled) {
          setUsuarios(data);
        }
      } catch (error) {
        if (!cancelled) {
          const status = (error as { status?: number }).status;
          if (status === 403) {
            setErrorMessage("No tenés permisos para listar usuarios.");
          } else {
            setErrorMessage("No se pudieron cargar los usuarios. Intentá de nuevo.");
          }
          setUsuarios([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadUsuarios();

    return () => {
      cancelled = true;
    };
  }, [canView]);

  const filteredUsuarios = React.useMemo(() => {
    const filtered = usuarios.filter((usuario) => matchesSearch(usuario, search));
    const sorted = [...filtered].sort((a, b) => {
      const result = compareUsuarios(a, b, sortKey);
      return sortDir === "asc" ? result : -result;
    });
    return sorted;
  }, [usuarios, search, sortKey, sortDir]);

  const allFilteredSelected =
    filteredUsuarios.length > 0 &&
    filteredUsuarios.every((usuario) => selectedIds.has(usuario.id));

  function toggleSelectAll(checked: boolean | "indeterminate") {
    if (checked === true) {
      setSelectedIds(new Set(filteredUsuarios.map((usuario) => usuario.id)));
      return;
    }
    setSelectedIds(new Set());
  }

  function toggleSelectOne(id: number, checked: boolean | "indeterminate") {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function openHabilitadoConfirm(usuario: UsuarioListItem) {
    setConfirmError(null);
    setConfirmState({
      usuario,
      nextHabilitado: !usuario.habilitado,
    });
  }

  function closeHabilitadoConfirm() {
    if (isUpdatingHabilitado) {
      return;
    }
    setConfirmState(null);
    setConfirmError(null);
  }

  async function confirmHabilitadoChange() {
    if (!confirmState) {
      return;
    }

    setIsUpdatingHabilitado(true);
    setConfirmError(null);
    try {
      const updated = await apiFetch<UsuarioListItem>(
        `/api/usuarios/${confirmState.usuario.id}/habilitado`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habilitado: confirmState.nextHabilitado }),
        }
      );
      setUsuarios((prev) =>
        prev.map((usuario) => (usuario.id === updated.id ? updated : usuario))
      );
      setConfirmState(null);
    } catch {
      setConfirmError("No se pudo actualizar el estado del usuario. Intentá de nuevo.");
    } finally {
      setIsUpdatingHabilitado(false);
    }
  }

  if (!canView) {
    return <AccessDenied />;
  }

  const confirmFullName = confirmState
    ? `${confirmState.usuario.nombre} ${confirmState.usuario.apellido}`.trim()
    : "";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Admin</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Administración de cuentas, roles y accesos al sistema.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, apellido o usuario..."
              className="h-10 bg-background pl-9"
              disabled={isLoading}
            />
          </div>

          {canCreate ? (
            <Button type="button" className="shrink-0" asChild>
              <Link to="/admin/usuarios/nuevo">
                <Plus className="size-4" />
                Nuevo Usuario
              </Link>
            </Button>
          ) : null}
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {isLoading ? (
            <UsuariosTableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <SortableHead
                    label="Nombre y Apellido"
                    sortKey="nombre"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Nombre de Usuario"
                    sortKey="username"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Último Inicio de Sesión"
                    sortKey="ultimo_inicio"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Estado"
                    sortKey="estado"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Rol"
                    sortKey="rol"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="text-left">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsuarios.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-5" />
                        <p className="text-sm">
                          {usuarios.length === 0
                            ? "No hay usuarios para mostrar."
                            : "No se encontraron usuarios con ese criterio."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsuarios.map((usuario) => {
                    const fullName = `${usuario.nombre} ${usuario.apellido}`.trim();

                    return (
                      <TableRow key={usuario.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(usuario.id)}
                            onCheckedChange={(checked) =>
                              toggleSelectOne(usuario.id, checked)
                            }
                            aria-label={`Seleccionar ${fullName}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{fullName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          @{usuario.username}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatUltimoInicio(usuario.ultimo_inicio_sesion)}
                        </TableCell>
                        <TableCell>
                          {usuario.habilitado ? (
                            <Badge className="border-transparent bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/40 dark:text-green-300">
                              Activo
                            </Badge>
                          ) : (
                            <Badge className="border-transparent bg-destructive/10 text-destructive hover:bg-destructive/10">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/admin/roles/${usuario.rol_id}`}
                            className="font-medium text-blue-600 underline hover:text-blue-800"
                          >
                            {usuario.rol_nombre}
                          </Link>
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-start gap-1">
                            {canEdit ? (
                              <ActionIconButton
                                label={
                                  usuario.habilitado
                                    ? "Inhabilitar usuario"
                                    : "Habilitar usuario"
                                }
                                onClick={() => openHabilitadoConfirm(usuario)}
                              >
                                {usuario.habilitado ? (
                                  <UserX className="size-4" />
                                ) : (
                                  <UserCheck className="size-4" />
                                )}
                              </ActionIconButton>
                            ) : null}

                            {canCreate ? (
                              <ActionIconButton label="Crear usuario tomando a este como plantilla">
                                <Copy className="size-4" />
                              </ActionIconButton>
                            ) : null}

                            {canEdit ? (
                              <ActionIconButton label="Restablecer contraseña">
                                <KeyRound className="size-4" />
                              </ActionIconButton>
                            ) : null}

                            {canView ? (
                              <ActionIconButton
                                label="Ver detalle"
                                to={`/admin/usuarios/${usuario.id}`}
                              >
                                <Eye className="size-4" />
                              </ActionIconButton>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {!isLoading ? (
          <p className="text-xs text-muted-foreground">
            {filteredUsuarios.length} de {usuarios.length} usuarios
            {selectedIds.size > 0 ? ` · ${selectedIds.size} seleccionados` : ""}
          </p>
        ) : null}

        <Dialog
          open={confirmState !== null}
          onOpenChange={(open) => {
            if (!open) {
              closeHabilitadoConfirm();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmState?.nextHabilitado ? "Habilitar usuario" : "Inhabilitar usuario"}
              </DialogTitle>
              <DialogDescription>
                {confirmState?.nextHabilitado
                  ? `¿Confirmás habilitar a ${confirmFullName} (@${confirmState.usuario.username})? Podrá volver a iniciar sesión.`
                  : `¿Confirmás inhabilitar a ${confirmFullName} (@${confirmState?.usuario.username})? Se cerrarán sus sesiones activas.`}
              </DialogDescription>
            </DialogHeader>

            {confirmError ? (
              <p className="text-sm text-destructive">{confirmError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeHabilitadoConfirm}
                disabled={isUpdatingHabilitado}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant={confirmState?.nextHabilitado ? "default" : "destructive"}
                onClick={() => void confirmHabilitadoChange()}
                disabled={isUpdatingHabilitado}
              >
                {isUpdatingHabilitado
                  ? "Guardando..."
                  : confirmState?.nextHabilitado
                    ? "Habilitar"
                    : "Inhabilitar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
