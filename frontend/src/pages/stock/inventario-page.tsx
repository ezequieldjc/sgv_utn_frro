import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, History, Loader2, Package, PackagePlus, Pencil, Power, Search } from "lucide-react";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import {
  PERMISOS_STOCK,
  fmtCantidad,
  fmtMoneda,
  formatoStock,
  hasAnyPermission,
  hasPermission,
} from "@/lib/stock";
import type { ProductoItem, ProductoListResponse, RubroOpcion } from "@/types/stock";
import { AccessDenied, AlertaBadge, BannerError, BannerExito, EncabezadoStock, selectInlineClass } from "./shared";

type FiltroActivo = "true" | "false" | "todos";

export default function InventarioPage() {
  const { permisos } = useAuth();
  const canView = hasAnyPermission(permisos, PERMISOS_STOCK);
  const canCrear = hasPermission(permisos, "stock:crear_insumo");
  const canEditar = hasPermission(permisos, "stock:editar_insumo");
  const canMover = hasPermission(permisos, "stock:registrar_movimiento");
  const canVerMov = hasPermission(permisos, "stock:ver_movimientos");

  const [q, setQ] = React.useState("");
  const [rubroId, setRubroId] = React.useState("");
  const [activo, setActivo] = React.useState<FiltroActivo>("true");
  const [soloAlertas, setSoloAlertas] = React.useState(false);
  const [rubros, setRubros] = React.useState<RubroOpcion[]>([]);
  const [productos, setProductos] = React.useState<ProductoItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [recarga, setRecarga] = React.useState(0);
  const [cambiandoEstado, setCambiandoEstado] = React.useState<ProductoItem | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    apiFetch<RubroOpcion[]>("/api/stock/rubros").then(setRubros).catch(() => setRubros([]));
  }, [canView]);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const base = new URLSearchParams({ page_size: "200" });
      if (q.trim()) base.set("q", q.trim());
      if (rubroId) base.set("rubro_id", rubroId);
      if (soloAlertas) base.set("con_alerta", "true");
      const estados = activo === "todos" ? ["true", "false"] : [activo];
      void (async () => {
        setIsLoading(true);
        try {
          const respuestas = await Promise.all(
            estados.map((estado) => {
              const params = new URLSearchParams(base);
              params.set("activo", estado);
              return apiFetch<ProductoListResponse>(`/api/stock/productos?${params.toString()}`);
            }),
          );
          if (!cancelled) {
            const items = respuestas.flatMap((r) => r.items);
            items.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
            setProductos(items);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) setError(mensajeError(err, "No se pudo cargar el inventario."));
        } finally {
          if (!cancelled) setIsLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canView, q, rubroId, activo, soloAlertas, recarga]);

  if (!canView) {
    return <AccessDenied mensaje="No tenés permiso para ver el inventario." />;
  }

  async function confirmarCambioEstado() {
    if (!cambiandoEstado) return;
    setIsSaving(true);
    try {
      const actualizado = await apiFetch<ProductoItem>(`/api/stock/productos/${cambiandoEstado.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !cambiandoEstado.activo }),
      });
      setAviso(`${actualizado.nombre} ${actualizado.activo ? "reactivado" : "dado de baja"}.`);
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeError(err, "No se pudo actualizar el producto."));
    } finally {
      setIsSaving(false);
      setCambiandoEstado(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <EncabezadoStock
        titulo="Inventario"
        subtitulo="Stock único de consultorio y pet shop: envases cerrados y cantidad abierta."
        acciones={
          canCrear ? (
            <Button asChild>
              <Link to="/stock/alta">
                <PackagePlus />
                Nuevo producto
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o proveedor…"
            className="pl-9"
            aria-label="Buscar producto"
          />
        </div>
        <select aria-label="Filtrar por rubro" value={rubroId} onChange={(e) => setRubroId(e.target.value)} className={selectInlineClass}>
          <option value="">Todos los rubros</option>
          {rubros.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.nombre}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por estado" value={activo} onChange={(e) => setActivo(e.target.value as FiltroActivo)} className={selectInlineClass}>
          <option value="true">Activos</option>
          <option value="false">Dados de baja</option>
          <option value="todos">Todos</option>
        </select>
        <div className="flex items-center gap-2">
          <Checkbox id="solo_alertas" checked={soloAlertas} onCheckedChange={(c) => setSoloAlertas(c === true)} />
          <Label htmlFor="solo_alertas" className="text-sm font-normal">
            Solo con alertas
          </Label>
        </div>
        {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? <BannerError>{error}</BannerError> : null}
      {aviso ? <BannerExito>{aviso}</BannerExito> : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Rubro</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Precio de venta</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-2 size-6" />
                  {isLoading ? "Cargando…" : "No hay productos con esos filtros."}
                </TableCell>
              </TableRow>
            ) : (
              productos.map((p) => (
                <TableRow key={p.id} className={p.activo ? "" : "opacity-60"}>
                  <TableCell>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.alertas.map((a) => (
                        <AlertaBadge key={a} alerta={a} />
                      ))}
                      {!p.activo ? (
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">Dado de baja</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.rubro_nombre}</TableCell>
                  <TableCell>
                    <div>{formatoStock(p)}</div>
                    {p.fraccionable ? (
                      <div className="text-xs text-muted-foreground">
                        ≈ {fmtCantidad(p.stock_equivalente_envases)} envases de {fmtCantidad(p.contenido_envase)} {p.unidad}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.stock_minimo}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.se_vende ? fmtMoneda(p.precio_venta) : <span className="text-muted-foreground">No se vende</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canMover ? (
                        <Button variant="ghost" size="icon" asChild title="Registrar movimiento">
                          <Link to={`/stock/movimientos?producto_id=${p.id}`} aria-label={`Registrar movimiento de ${p.nombre}`}>
                            <ArrowLeftRight />
                          </Link>
                        </Button>
                      ) : null}
                      {canVerMov && !canMover ? (
                        <Button variant="ghost" size="icon" asChild title="Ver movimientos">
                          <Link to={`/stock/movimientos?producto_id=${p.id}`} aria-label={`Ver movimientos de ${p.nombre}`}>
                            <History />
                          </Link>
                        </Button>
                      ) : null}
                      {canEditar ? (
                        <>
                          <Button variant="ghost" size="icon" asChild title="Editar">
                            <Link to={`/stock/${p.id}/editar`} aria-label={`Editar ${p.nombre}`}>
                              <Pencil />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={p.activo ? "Dar de baja" : "Reactivar"}
                            aria-label={p.activo ? `Dar de baja ${p.nombre}` : `Reactivar ${p.nombre}`}
                            onClick={() => setCambiandoEstado(p)}
                          >
                            <Power className={p.activo ? "text-destructive dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"} />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={cambiandoEstado !== null} onOpenChange={(o) => (!o ? setCambiandoEstado(null) : undefined)}>
        <DialogContent>
          {cambiandoEstado ? (
            <>
              <DialogHeader>
                <DialogTitle>{cambiandoEstado.activo ? "Dar de baja producto" : "Reactivar producto"}</DialogTitle>
                <DialogDescription>
                  {cambiandoEstado.activo
                    ? `${cambiandoEstado.nombre} dejará de aparecer en ventas y movimientos (solo admitirá ajustes). El historial se conserva.`
                    : `${cambiandoEstado.nombre} vuelve a estar disponible.`}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" disabled={isSaving} onClick={() => setCambiandoEstado(null)}>
                  Volver
                </Button>
                <Button
                  variant={cambiandoEstado.activo ? "destructive" : "default"}
                  disabled={isSaving}
                  onClick={() => void confirmarCambioEstado()}
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : null}
                  {cambiandoEstado.activo ? "Dar de baja" : "Reactivar"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
