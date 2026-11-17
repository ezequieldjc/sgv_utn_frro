import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarPlus, CheckCircle2, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import {
  fechaAntesDePermitida,
  horaLabel,
  mensajePortal,
  PERMISO_PEDIR_TURNO,
  puedeBuscarHorarios,
  turnoLabel,
  type PedidoTurnoForm,
} from "@/lib/portal";
import type {
  PortalDisponibilidad,
  PortalTurno,
  PortalTurnoCreate,
  PortalTurnoOpciones,
} from "@/types/portal";

import { AccessDenied, selectClass } from "../stock/shared";
import { Cargando, EncabezadoPortal, ErrorPortal, usePortal, Vacio } from "./portal-componentes";

const FORM_VACIO: PedidoTurnoForm = {
  mascota_id: "",
  tipo_turno_id: "",
  veterinario_id: "",
  fecha: "",
  fecha_hora_inicio: "",
};

function mensajeAlPedir(error: unknown): string {
  const body = (error as { body?: { detalle?: unknown } })?.body;
  const status = (error as { status?: number })?.status;
  if ((status === 400 || status === 409) && typeof body?.detalle === "string") {
    return body.detalle;
  }
  return mensajePortal(error, "esa mascota");
}

export default function PedirTurnoPage() {
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const puedePedir = permisos.includes("*") || permisos.includes(PERMISO_PEDIR_TURNO);
  const opciones = usePortal<PortalTurnoOpciones>(
    puedePedir ? "/api/portal/turnos/opciones" : null,
    "las opciones para pedir turno",
  );

  const [form, setForm] = React.useState<PedidoTurnoForm>(FORM_VACIO);
  const [horarios, setHorarios] = React.useState<PortalDisponibilidad | null>(null);
  const [buscando, setBuscando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);
  const [creado, setCreado] = React.useState<PortalTurno | null>(null);

  const primerDia = opciones.data?.primer_dia ?? "";
  const fechaInvalida = fechaAntesDePermitida(form.fecha, primerDia);

  React.useEffect(() => {
    setHorarios(null);
    if (!puedeBuscarHorarios(form) || fechaInvalida) {
      return;
    }
    let cancelado = false;
    setBuscando(true);
    setError(null);
    const params = new URLSearchParams({
      mascota_id: form.mascota_id,
      veterinario_id: form.veterinario_id,
      tipo_turno_id: form.tipo_turno_id,
      fecha: form.fecha,
    });
    void apiFetch<PortalDisponibilidad>(`/api/portal/turnos/disponibilidad?${params.toString()}`)
      .then((res) => {
        if (!cancelado) {
          setHorarios(res);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(mensajeAlPedir(err));
        }
      })
      .finally(() => {
        if (!cancelado) {
          setBuscando(false);
        }
      });
    return () => {
      cancelado = true;
    };
    // Los horarios se vuelven a buscar solo cuando cambia algún dato de la búsqueda.
  }, [form.mascota_id, form.tipo_turno_id, form.veterinario_id, form.fecha, fechaInvalida]);

  function actualizar(campo: keyof PedidoTurnoForm, valor: string) {
    setForm((prev) => ({ ...prev, [campo]: valor, fecha_hora_inicio: "" }));
  }

  async function confirmar() {
    if (!form.fecha_hora_inicio) {
      return;
    }
    setEnviando(true);
    setError(null);
    const payload: PortalTurnoCreate = {
      mascota_id: Number(form.mascota_id),
      veterinario_id: Number(form.veterinario_id),
      tipo_turno_id: Number(form.tipo_turno_id),
      fecha_hora_inicio: form.fecha_hora_inicio,
    };
    try {
      const turno = await apiFetch<PortalTurno>("/api/portal/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCreado(turno);
    } catch (err: unknown) {
      setError(mensajeAlPedir(err));
    } finally {
      setEnviando(false);
    }
  }

  if (!puedePedir) {
    return (
      <AccessDenied
        mensaje="Tu usuario no puede pedir turnos desde el portal."
        volverA="/portal/turnos"
        volverLabel="Volver a mis turnos"
      />
    );
  }

  if (creado) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="space-y-3 rounded-2xl border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <h1 className="text-xl font-semibold">Tu turno quedó solicitado</h1>
          <p className="text-sm text-muted-foreground">
            {creado.tipo_turno_nombre} de {creado.mascota_nombre} con {creado.veterinario_nombre},{" "}
            <span className="capitalize">{turnoLabel(creado.fecha_hora_inicio)}</span>.
          </p>
          <p className="text-sm">
            La clínica lo va a revisar y confirmar. Mientras siga solicitado, lo podés cancelar
            desde <strong>Mis turnos</strong>.
          </p>
          <Button onClick={() => navigate("/portal/turnos")}>Ir a mis turnos</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <EncabezadoPortal
        titulo="Pedir turno"
        subtitulo="El turno queda solicitado hasta que la clínica lo confirme."
        volverA="/portal/turnos"
        volverLabel="Mis turnos"
      />

      {opciones.cargando ? <Cargando /> : null}
      {opciones.error ? <ErrorPortal mensaje={opciones.error} /> : null}

      {opciones.data && opciones.data.mascotas.length === 0 ? (
        <Vacio>
          <Phone className="mx-auto mb-2 size-5" />
          Todavía no tenés mascotas registradas. Para registrar a tu mascota y sacar el primer
          turno, comunicate con la clínica.
        </Vacio>
      ) : null}

      {opciones.data && opciones.data.mascotas.length > 0 ? (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
          <div className="space-y-2">
            <Label htmlFor="mascota">Mascota</Label>
            <select
              id="mascota"
              className={selectClass}
              value={form.mascota_id}
              onChange={(e) => actualizar("mascota_id", e.target.value)}
            >
              <option value="">Elegí una mascota</option>
              {opciones.data.mascotas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de turno</Label>
            <select
              id="tipo"
              className={selectClass}
              value={form.tipo_turno_id}
              onChange={(e) => actualizar("tipo_turno_id", e.target.value)}
            >
              <option value="">Elegí el tipo</option>
              {opciones.data.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Para otro tipo de atención (por ejemplo, una cirugía), comunicate con la clínica.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="veterinario">Veterinario/a</Label>
            <select
              id="veterinario"
              className={selectClass}
              value={form.veterinario_id}
              onChange={(e) => actualizar("veterinario_id", e.target.value)}
            >
              <option value="">Elegí quién te atiende</option>
              {opciones.data.veterinarios.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha">Día</Label>
            <Input
              id="fecha"
              type="date"
              min={primerDia}
              value={form.fecha}
              onChange={(e) => actualizar("fecha", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Desde el portal se piden turnos a partir de mañana. Para hoy, comunicate con la
              clínica.
            </p>
            {fechaInvalida ? (
              <p className="text-xs text-destructive">Elegí un día a partir de mañana.</p>
            ) : null}
          </div>

          {puedeBuscarHorarios(form) && !fechaInvalida ? (
            <div className="space-y-2">
              <Label>Horario</Label>
              {buscando ? <p className="text-sm text-muted-foreground">Buscando horarios…</p> : null}
              {horarios && horarios.horarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay horarios libres ese día. Probá con otro día o con otro veterinario/a.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {horarios?.horarios.map((h) => (
                  <Button
                    key={h.fecha_hora_inicio}
                    type="button"
                    size="sm"
                    variant={form.fecha_hora_inicio === h.fecha_hora_inicio ? "default" : "outline"}
                    aria-pressed={form.fecha_hora_inicio === h.fecha_hora_inicio}
                    onClick={() => setForm((prev) => ({ ...prev, fecha_hora_inicio: h.fecha_hora_inicio }))}
                  >
                    {horaLabel(h.fecha_hora_inicio)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? <ErrorPortal mensaje={error} /> : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to="/portal/turnos">Volver</Link>
            </Button>
            <Button
              type="button"
              disabled={!form.fecha_hora_inicio || enviando}
              onClick={() => void confirmar()}
            >
              <CalendarPlus className="mr-2 size-4" />
              {enviando ? "Pidiendo…" : "Pedir turno"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
