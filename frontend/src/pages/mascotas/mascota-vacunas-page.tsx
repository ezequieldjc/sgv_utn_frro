import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ClipboardList, Loader2, Syringe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { PERMISOS_HISTORIAL, hasAnyPermission, hasPermission } from "@/lib/consultas";
import { MEDIO_PAGO_LABEL, fmtMoneda } from "@/lib/stock";
import {
  ESTADO_DOSIS_CLASE,
  PERMISOS_VER_VACUNAS,
  TIPO_PREVENTIVO_LABEL,
  armarPayloadVacuna,
  diasLabel,
  diasRefuerzo,
  dosisPendientes,
  estadoDosisTexto,
  fechaCorta,
  formInicial,
  mensajeErrorApi,
  pesoPropuesto,
  proximaDosisSugerida,
  refuerzoSugerido,
  validarVacuna,
  type VacunaErrors,
  type VacunaForm,
} from "@/lib/vacunas";
import type {
  ProductoPreventivoOpcion,
  TipoPreventivo,
  TratamientoPreventivoResultado,
  VacunasMascotaResponse,
} from "@/types/vacunas";
import type { MedioPago } from "@/types/ventas";

import {
  AccessDenied,
  BannerAdvertencias,
  BannerError,
  BannerExito,
  fieldClass,
  selectClass,
} from "../stock/shared";

const MEDIOS: MedioPago[] = ["efectivo", "debito", "credito", "transferencia"];
const TIPOS: TipoPreventivo[] = ["vacunacion", "desparasitacion"];
const RUBRO_POR_TIPO: Record<TipoPreventivo, string> = {
  vacunacion: "Vacuna",
  desparasitacion: "Antiparasitario",
};

function idDeParametro(valor: string | null): number | null {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : null;
}

function ErrorCampo({ children }: { children?: string }) {
  return children ? <p className="text-xs text-destructive">{children}</p> : null;
}

function Opcion({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activa ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export default function MascotaVacunasPage() {
  const { id } = useParams();
  const mascotaId = Number(id);
  const [searchParams] = useSearchParams();
  const turnoId = idDeParametro(searchParams.get("turno_id"));
  const consultaId = idDeParametro(searchParams.get("consulta_id"));
  const { permisos } = useAuth();
  const canVer = hasAnyPermission(permisos, PERMISOS_VER_VACUNAS);
  const canRegistrar = hasPermission(permisos, "vacunas:registrar");
  const canHistoria = hasAnyPermission(permisos, PERMISOS_HISTORIAL);

  const [data, setData] = React.useState<VacunasMascotaResponse | null>(null);
  const [productos, setProductos] = React.useState<ProductoPreventivoOpcion[]>([]);
  const [form, setForm] = React.useState<VacunaForm | null>(null);
  const [errores, setErrores] = React.useState<VacunaErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<TratamientoPreventivoResultado | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);
  // Si el veterinario eligió a mano qué dosis completa, la sugerencia deja de pisarla.
  const [refuerzoElegido, setRefuerzoElegido] = React.useState(false);

  const cargar = React.useCallback(async () => {
    const respuesta = await apiFetch<VacunasMascotaResponse>(`/api/vacunas?mascota_id=${mascotaId}`);
    setData(respuesta);
    return respuesta;
  }, [mascotaId]);

  React.useEffect(() => {
    if (!canVer || !Number.isInteger(mascotaId)) {
      return;
    }
    let cancelado = false;
    setCargando(true);
    void cargar()
      .then((respuesta) => {
        if (!cancelado) {
          setForm(formInicial(respuesta.hoy, respuesta.config, respuesta.mascota.ultimo_peso));
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(mensajeErrorApi(err, "No se pudo cargar el carnet de la mascota."));
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCargando(false);
        }
      });
    if (canRegistrar) {
      void apiFetch<ProductoPreventivoOpcion[]>("/api/vacunas/productos")
        .then((rows) => !cancelado && setProductos(rows))
        .catch(() => !cancelado && setProductos([]));
    }
    return () => {
      cancelado = true;
    };
  }, [canVer, canRegistrar, cargar, mascotaId]);

  const items = data?.items ?? [];
  const producto = form ? productos.find((p) => String(p.id) === form.producto_id) ?? null : null;
  const nombreParaRefuerzo = form
    ? form.modo === "aplicar"
      ? producto?.nombre ?? ""
      : form.nombre_producto
    : "";

  // Propone qué dosis anterior completa esta aplicación (mismo producto, vencida o por vencer).
  React.useEffect(() => {
    if (!form || refuerzoElegido) {
      return;
    }
    const sugerido = refuerzoSugerido(items, form.tipo, nombreParaRefuerzo);
    const valor = sugerido ? String(sugerido) : "";
    if (valor !== form.refuerzo_de_id) {
      setForm((prev) => (prev ? { ...prev, refuerzo_de_id: valor } : prev));
    }
  }, [form, items, nombreParaRefuerzo, refuerzoElegido]);

  if (!canVer) {
    return <AccessDenied mensaje="No tenés permiso para ver las vacunas de las mascotas." />;
  }
  if (cargando) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!data || !form) {
    return (
      <div className="space-y-4">
        <BannerError>{error ?? "No se encontró la mascota."}</BannerError>
        <Button variant="outline" asChild>
          <Link to="/mascotas">Volver al listado</Link>
        </Button>
      </div>
    );
  }

  const { mascota, config, hoy } = data;
  const pendientes = dosisPendientes(items, form.tipo);
  const productosDelTipo = productos.filter((p) => p.tipo === form.tipo);
  const fechaBase = form.modo === "aplicar" ? hoy : form.fecha_aplicacion;
  const sinPrecio = form.modo === "aplicar" && producto !== null && producto.precio_venta === null;
  const puedeRegistrar = canRegistrar && mascota.atendible;

  function actualizar(cambios: Partial<VacunaForm>) {
    setForm((prev) => (prev ? { ...prev, ...cambios } : prev));
    setErrores((prev) => {
      const siguiente = { ...prev };
      for (const campo of Object.keys(cambios) as (keyof VacunaForm)[]) {
        delete siguiente[campo];
      }
      return siguiente;
    });
  }

  function cambiarTipo(tipo: TipoPreventivo) {
    setRefuerzoElegido(false);
    actualizar({
      tipo,
      producto_id: "",
      fecha_proxima_dosis: fechaBase ? proximaDosisSugerida(fechaBase, tipo, config) : "",
    });
  }

  function cambiarModo(modo: VacunaForm["modo"]) {
    setRefuerzoElegido(false);
    const fecha = modo === "aplicar" ? hoy : "";
    actualizar({
      modo,
      fecha_aplicacion: fecha,
      fecha_proxima_dosis: fecha ? proximaDosisSugerida(fecha, form!.tipo, config) : "",
      cobrar: modo === "aplicar",
      peso_kg: pesoPropuesto(modo, mascota.ultimo_peso),
    });
  }

  function elegirProducto(productoId: string) {
    const elegido = productos.find((p) => String(p.id) === productoId);
    actualizar({ producto_id: productoId, cobrar: Boolean(elegido && elegido.precio_venta !== null) });
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (!form) {
      return;
    }
    const encontrados = validarVacuna(form, hoy);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) {
      return;
    }
    setGuardando(true);
    setError(null);
    setResultado(null);
    try {
      const respuesta = await apiFetch<TratamientoPreventivoResultado>("/api/vacunas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(armarPayloadVacuna(form, { mascotaId, turnoId, consultaId })),
      });
      setResultado(respuesta);
      const actualizada = await cargar();
      setRefuerzoElegido(false);
      setForm({
        ...formInicial(actualizada.hoy, actualizada.config, actualizada.mascota.ultimo_peso),
        tipo: form.tipo,
        modo: form.modo,
        fecha_proxima_dosis:
          form.modo === "aplicar"
            ? proximaDosisSugerida(actualizada.hoy, form.tipo, actualizada.config)
            : "",
        fecha_aplicacion: form.modo === "aplicar" ? actualizada.hoy : "",
        peso_kg: pesoPropuesto(form.modo, actualizada.mascota.ultimo_peso),
      });
      if (canRegistrar) {
        void apiFetch<ProductoPreventivoOpcion[]>("/api/vacunas/productos").then(setProductos);
      }
    } catch (err) {
      setError(mensajeErrorApi(err, "No se pudo registrar la aplicación."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Syringe className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Medicina preventiva</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vacunas y desparasitaciones de {mascota.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mascota.especie_nombre}, {mascota.raza_nombre} · Tutor: {mascota.tutor_nombre} · Estado:{" "}
            {mascota.estado_nombre}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canHistoria ? (
            <Button variant="outline" asChild>
              <Link to={`/consultas/historial?mascota_id=${mascota.id}`}>
                <ClipboardList />
                Historia clínica
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/mascotas">Volver al listado</Link>
          </Button>
        </div>
      </div>

      {turnoId && puedeRegistrar ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Registrando la aplicación del turno #{turnoId}: al guardar, el turno queda atendido.
        </div>
      ) : null}
      {consultaId && puedeRegistrar ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          La aplicación queda vinculada a la consulta #{consultaId}.
        </div>
      ) : null}
      {!mascota.atendible ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {mascota.nombre} está en estado «{mascota.estado_nombre}»: no puede recibir aplicaciones
          nuevas.
        </div>
      ) : null}

      {resultado ? (
        <div className="space-y-2">
          <BannerExito>
            <p className="font-medium">
              Se registró {resultado.item.nombre_producto} (
              {TIPO_PREVENTIVO_LABEL[resultado.item.tipo].toLowerCase()}).
            </p>
            <p className="text-xs">
              {resultado.venta_id
                ? `Venta #${resultado.venta_id} por ${fmtMoneda(resultado.venta_total)}. `
                : resultado.item.aplicada_en_clinica
                  ? "Se descontó del stock como consumo clínico. "
                  : "Dosis anterior: no movió stock. "}
              {resultado.item.fecha_proxima_dosis
                ? `Próxima dosis: ${fechaCorta(resultado.item.fecha_proxima_dosis)}.`
                : "Sin refuerzo."}
              {resultado.turno_atendido ? " El turno quedó atendido." : ""}
            </p>
          </BannerExito>
          <BannerAdvertencias advertencias={resultado.advertencias} />
        </div>
      ) : null}
      {error ? <BannerError>{error}</BannerError> : null}

      <div className={`grid gap-6 ${puedeRegistrar ? "lg:grid-cols-[minmax(0,1fr)_24rem]" : ""}`}>
        <section className="min-w-0 rounded-2xl border bg-card shadow-sm">
          <h2 className="border-b px-5 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Carnet
          </h2>
          {items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no tiene vacunas ni desparasitaciones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Próxima dosis</TableHead>
                  <TableHead>Registró</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap align-top">
                      {fechaCorta(item.fecha_aplicacion)}
                      <div className="text-xs text-muted-foreground">
                        {TIPO_PREVENTIVO_LABEL[item.tipo]}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">{item.nombre_producto}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.aplicada_en_clinica ? "Aplicada en la clínica" : "Dosis anterior"}
                        {item.lote ? ` · Lote ${item.lote}` : ""}
                        {item.venta_id ? ` · Venta #${item.venta_id}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {item.fecha_proxima_dosis ? (
                        <div className="whitespace-nowrap">{fechaCorta(item.fecha_proxima_dosis)}</div>
                      ) : null}
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_DOSIS_CLASE[item.estado_dosis]}`}
                      >
                        {estadoDosisTexto(item)}
                      </span>
                    </TableCell>
                    <TableCell className="align-top text-sm">{item.usuario_nombre}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        {puedeRegistrar ? (
          <form
            onSubmit={(event) => void guardar(event)}
            className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm lg:sticky lg:top-4 lg:self-start"
            noValidate
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Registrar
            </h2>
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Qué se registra">
              <Opcion activa={form.modo === "aplicar"} onClick={() => cambiarModo("aplicar")}>
                Aplicar ahora
              </Opcion>
              <Opcion activa={form.modo === "anterior"} onClick={() => cambiarModo("anterior")}>
                Dosis anterior
              </Opcion>
            </div>
            <p className="text-xs text-muted-foreground">
              {form.modo === "aplicar"
                ? "Se aplica hoy con un producto del stock: descuenta un envase y se puede cobrar."
                : "Una dosis que ya se dio (libreta sanitaria, otra veterinaria). No mueve stock."}
            </p>

            <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Tipo">
              {TIPOS.map((tipo) => (
                <Opcion key={tipo} activa={form.tipo === tipo} onClick={() => cambiarTipo(tipo)}>
                  {TIPO_PREVENTIVO_LABEL[tipo]}
                </Opcion>
              ))}
            </div>

            {form.modo === "aplicar" ? (
              <div className="space-y-2">
                <Label htmlFor="producto">Producto</Label>
                <select
                  id="producto"
                  className={`${selectClass} ${fieldClass(Boolean(errores.producto_id))}`}
                  value={form.producto_id}
                  onChange={(e) => elegirProducto(e.target.value)}
                >
                  <option value="">Seleccionar…</option>
                  {productosDelTipo.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre} · {p.envases_cerrados} en stock
                      {p.precio_venta !== null ? ` · ${fmtMoneda(p.precio_venta)}` : ""}
                    </option>
                  ))}
                </select>
                {productosDelTipo.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay productos del rubro «{RUBRO_POR_TIPO[form.tipo]}» en el stock.
                  </p>
                ) : null}
                <ErrorCampo>{errores.producto_id}</ErrorCampo>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nombre_producto">Producto</Label>
                  <Input
                    id="nombre_producto"
                    list="productos-preventivos"
                    value={form.nombre_producto}
                    placeholder="Por ejemplo: Séxtuple"
                    className={fieldClass(Boolean(errores.nombre_producto))}
                    onChange={(e) => actualizar({ nombre_producto: e.target.value })}
                  />
                  <datalist id="productos-preventivos">
                    {productosDelTipo.map((p) => (
                      <option key={p.id} value={p.nombre} />
                    ))}
                  </datalist>
                  <ErrorCampo>{errores.nombre_producto}</ErrorCampo>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha_aplicacion">Fecha de aplicación</Label>
                  <Input
                    id="fecha_aplicacion"
                    type="date"
                    max={hoy}
                    value={form.fecha_aplicacion}
                    className={fieldClass(Boolean(errores.fecha_aplicacion))}
                    onChange={(e) =>
                      actualizar({
                        fecha_aplicacion: e.target.value,
                        fecha_proxima_dosis: e.target.value
                          ? proximaDosisSugerida(e.target.value, form.tipo, config)
                          : "",
                      })
                    }
                  />
                  <ErrorCampo>{errores.fecha_aplicacion}</ErrorCampo>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="fecha_proxima_dosis">Próxima dosis</Label>
              <Input
                id="fecha_proxima_dosis"
                type="date"
                min={fechaBase || undefined}
                disabled={form.sin_refuerzo}
                value={form.sin_refuerzo ? "" : form.fecha_proxima_dosis}
                className={fieldClass(Boolean(errores.fecha_proxima_dosis))}
                onChange={(e) => actualizar({ fecha_proxima_dosis: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sin_refuerzo"
                  checked={form.sin_refuerzo}
                  onCheckedChange={(checked) =>
                    actualizar({
                      sin_refuerzo: checked === true,
                      fecha_proxima_dosis:
                        checked === true || !fechaBase
                          ? form.fecha_proxima_dosis
                          : proximaDosisSugerida(fechaBase, form.tipo, config),
                    })
                  }
                />
                <Label htmlFor="sin_refuerzo" className="text-xs font-normal">
                  Sin refuerzo
                </Label>
              </div>
              {!form.sin_refuerzo ? (
                <p className="text-xs text-muted-foreground">
                  Se propone a {diasRefuerzo(form.tipo, config)} días. El recordatorio por WhatsApp
                  aparece {config.dias_aviso_dosis} días antes.
                </p>
              ) : null}
              <ErrorCampo>{errores.fecha_proxima_dosis}</ErrorCampo>
            </div>

            {pendientes.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="refuerzo_de_id">¿Completa una dosis anterior?</Label>
                <select
                  id="refuerzo_de_id"
                  className={selectClass}
                  value={form.refuerzo_de_id}
                  onChange={(e) => {
                    setRefuerzoElegido(true);
                    actualizar({ refuerzo_de_id: e.target.value });
                  }}
                >
                  <option value="">No, es una dosis nueva</option>
                  {pendientes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre_producto} · {fechaCorta(p.fecha_aplicacion)} ·{" "}
                      {diasLabel(p.dias_para_vencer ?? 0)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  La dosis completada deja de aparecer en los recordatorios.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lote">Lote (opcional)</Label>
                <Input
                  id="lote"
                  value={form.lote}
                  className={fieldClass(Boolean(errores.lote))}
                  onChange={(e) => actualizar({ lote: e.target.value })}
                />
                <ErrorCampo>{errores.lote}</ErrorCampo>
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso_kg">Peso (kg)</Label>
                <Input
                  id="peso_kg"
                  inputMode="decimal"
                  value={form.peso_kg}
                  className={fieldClass(Boolean(errores.peso_kg))}
                  onChange={(e) => actualizar({ peso_kg: e.target.value })}
                />
                <ErrorCampo>{errores.peso_kg}</ErrorCampo>
              </div>
            </div>

            {form.modo === "aplicar" ? (
              <div className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cobrar"
                    checked={form.cobrar && !sinPrecio}
                    disabled={sinPrecio || producto === null}
                    onCheckedChange={(checked) => actualizar({ cobrar: checked === true })}
                  />
                  <Label htmlFor="cobrar">
                    Cobrar al tutor
                    {producto?.precio_venta ? ` (${fmtMoneda(producto.precio_venta)})` : ""}
                  </Label>
                </div>
                {sinPrecio ? (
                  <p className="text-xs text-muted-foreground">
                    El producto no tiene precio de venta: se registra como consumo clínico.
                  </p>
                ) : form.cobrar && producto ? (
                  <select
                    aria-label="Medio de pago"
                    className={selectClass}
                    value={form.medio_pago}
                    onChange={(e) => actualizar({ medio_pago: e.target.value as MedioPago })}
                  >
                    {MEDIOS.map((m) => (
                      <option key={m} value={m}>
                        {MEDIO_PAGO_LABEL[m]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Sin cobro: se descuenta del stock como consumo clínico.
                  </p>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="observaciones"
                rows={2}
                value={form.observaciones}
                className={fieldClass(Boolean(errores.observaciones))}
                onChange={(e) => actualizar({ observaciones: e.target.value })}
              />
              <ErrorCampo>{errores.observaciones}</ErrorCampo>
            </div>

            <Button type="submit" className="w-full" disabled={guardando}>
              {guardando ? <Loader2 className="animate-spin" /> : <Syringe />}
              {form.modo === "aplicar" ? "Registrar aplicación" : "Registrar dosis anterior"}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
