import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  addDays,
  format,
  getDay,
  isValid,
  parse,
  parseISO,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale/es";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldOff,
} from "lucide-react";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./agenda-calendar.css";

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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import {
  ESTADO_CLASES,
  ESTADO_LABEL,
  estaEnHorario,
  fechaIso,
  hasPermission,
  limitesHorario,
  mensajeError,
  puedeArrastrar,
  rangoParaVista,
  turnoToEvento,
  type EventoAgenda,
  type VistaAgenda,
} from "@/lib/agenda";
import type {
  EstadoTurno,
  HorarioAtencion,
  TipoTurnoOpcion,
  TurnoItem,
  TurnoListResponse,
  VeterinarioOpcion,
} from "@/types/agenda";
import { ReprogramarDialog } from "./reprogramar-dialog";
import { TurnoDetalleSheet } from "./turno-detalle-sheet";

interface Recurso {
  id: number;
  title: string;
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

const DnDCalendar = withDragAndDrop<EventoAgenda, Recurso>(Calendar);

const MENSAJES = {
  today: "Hoy",
  previous: "Anterior",
  next: "Siguiente",
  day: "Día",
  week: "Semana",
  agenda: "Lista",
  date: "Fecha",
  time: "Hora",
  event: "Turno",
  noEventsInRange: "No hay turnos en este período.",
  showMore: (total: number) => `+${total} más`,
};

const VISTAS: { value: VistaAgenda; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "agenda", label: "Lista" },
];

const LEYENDA: EstadoTurno[] = ["solicitado", "confirmado", "realizado", "no_asistio", "cancelado"];

const selectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

function fechaInicial(params: URLSearchParams): Date {
  const raw = params.get("fecha");
  if (raw) {
    const parsed = parseISO(raw);
    if (isValid(parsed)) {
      return parsed;
    }
  }
  return new Date();
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function tituloPeriodo(vista: VistaAgenda, fecha: Date): string {
  if (vista === "day") {
    return capitalizar(format(fecha, "EEEE d 'de' MMMM yyyy", { locale: es }));
  }
  if (vista === "week") {
    const lunes = startOfWeek(fecha, { weekStartsOn: 1 });
    const domingo = addDays(lunes, 6);
    return `${format(lunes, "d MMM", { locale: es })} – ${format(domingo, "d MMM yyyy", { locale: es })}`;
  }
  return `Desde ${format(fecha, "d 'de' MMMM", { locale: es })} (30 días)`;
}

function EventoTurno({ event }: { event: EventoAgenda }) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-medium">{event.turno.mascota_nombre}</div>
      <div className="truncate text-[11px] opacity-80">
        {event.turno.tipo_turno_nombre} · {event.turno.tutor_apellido}
      </div>
    </div>
  );
}

function EventoLista({ event }: { event: EventoAgenda }) {
  const t = event.turno;
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="font-medium">{t.mascota_nombre}</span>
      <span className="text-muted-foreground">
        {t.tipo_turno_nombre} · {t.tutor_nombre} {t.tutor_apellido} · {t.veterinario_nombre}{" "}
        {t.veterinario_apellido}
      </span>
      <span className={`turno-chip ${ESTADO_CLASES[t.estado]}`}>{ESTADO_LABEL[t.estado]}</span>
    </span>
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
          No tenés permiso para ver la agenda de turnos.
        </p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}

interface DropPendiente {
  turno: TurnoItem;
  inicio: Date;
  veterinarioId: number;
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { permisos } = useAuth();
  const canView = hasPermission(permisos, "agenda:ver");
  const canCreate = hasPermission(permisos, "agenda:crear_turno");
  const canEdit = hasPermission(permisos, "agenda:editar_turno");

  const [fecha, setFecha] = React.useState<Date>(() => fechaInicial(searchParams));
  const [vista, setVista] = React.useState<VistaAgenda>("day");
  const [vetFiltro, setVetFiltro] = React.useState("");
  const [mostrarCancelados, setMostrarCancelados] = React.useState(false);
  const [turnos, setTurnos] = React.useState<TurnoItem[]>([]);
  const [veterinarios, setVeterinarios] = React.useState<VeterinarioOpcion[]>([]);
  const [tipos, setTipos] = React.useState<TipoTurnoOpcion[]>([]);
  const [horario, setHorario] = React.useState<HorarioAtencion | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);
  const [recarga, setRecarga] = React.useState(0);
  const [seleccionado, setSeleccionado] = React.useState<TurnoItem | null>(null);
  const [reprogramando, setReprogramando] = React.useState<TurnoItem | null>(null);
  const [drop, setDrop] = React.useState<DropPendiente | null>(null);
  const [isDropping, setIsDropping] = React.useState(false);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void (async () => {
      try {
        const [vets, hor, tps] = await Promise.all([
          apiFetch<VeterinarioOpcion[]>("/api/agenda/veterinarios"),
          apiFetch<HorarioAtencion>("/api/agenda/horario"),
          apiFetch<TipoTurnoOpcion[]>("/api/agenda/tipos-turno"),
        ]);
        setVeterinarios(vets);
        setHorario(hor);
        setTipos(tps);
      } catch (err) {
        setError(mensajeError(err, "No se pudo cargar la configuración de la agenda."));
      }
    })();
  }, [canView]);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    let cancelled = false;
    const { desde, hasta } = rangoParaVista(vista, fecha);
    const params = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() });
    if (vetFiltro) {
      params.set("veterinario_id", vetFiltro);
    }
    void (async () => {
      setIsLoading(true);
      try {
        const data = await apiFetch<TurnoListResponse>(`/api/agenda/turnos?${params.toString()}`);
        if (!cancelled) {
          setTurnos(data.items);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(mensajeError(err, "No se pudieron cargar los turnos."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, vista, fecha, vetFiltro, recarga]);

  const eventos = React.useMemo(
    () =>
      turnos
        .filter((t) => mostrarCancelados || t.estado !== "cancelado")
        .map(turnoToEvento),
    [turnos, mostrarCancelados],
  );

  const recursos = React.useMemo<Recurso[] | undefined>(() => {
    if (vista !== "day") {
      return undefined;
    }
    const lista = vetFiltro ? veterinarios.filter((v) => String(v.id) === vetFiltro) : veterinarios;
    return lista.length > 0
      ? lista.map((v) => ({ id: v.id, title: `${v.nombre} ${v.apellido}` }))
      : undefined;
  }, [vista, vetFiltro, veterinarios]);

  const { min, max } = React.useMemo(() => limitesHorario(horario), [horario]);

  if (!canView) {
    return <AccessDenied />;
  }

  function mover(direccion: -1 | 1) {
    const salto = vista === "day" ? 1 : vista === "week" ? 7 : 30;
    setFecha((prev) => addDays(prev, salto * direccion));
  }

  function actualizarTurno(actualizado: TurnoItem) {
    setTurnos((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)));
    setSeleccionado((prev) => (prev && prev.id === actualizado.id ? actualizado : prev));
  }

  function handleSelectSlot(slot: SlotInfo) {
    if (!canCreate) {
      return;
    }
    const inicio = slot.start;
    if (!estaEnHorario(inicio, horario) || inicio.getTime() <= Date.now()) {
      return;
    }
    const params = new URLSearchParams({ fecha: fechaIso(inicio), hora: format(inicio, "HH:mm") });
    const vet = slot.resourceId ?? (vetFiltro || undefined);
    if (vet !== undefined) {
      params.set("veterinario_id", String(vet));
    }
    navigate(`/agenda/nuevo-turno?${params.toString()}`);
  }

  function handleEventDrop({ event, start, resourceId }: EventInteractionArgs<EventoAgenda>) {
    if (!puedeArrastrar(event.turno, permisos)) {
      return;
    }
    const inicio = new Date(start);
    const veterinarioId = resourceId !== undefined ? Number(resourceId) : event.turno.veterinario_id;
    if (
      inicio.getTime() === event.start.getTime() &&
      veterinarioId === event.turno.veterinario_id
    ) {
      return;
    }
    setDrop({ turno: event.turno, inicio, veterinarioId });
  }

  async function confirmarDrop() {
    if (!drop) {
      return;
    }
    setIsDropping(true);
    try {
      const payload: Record<string, unknown> = { fecha_hora_inicio: drop.inicio.toISOString() };
      if (drop.veterinarioId !== drop.turno.veterinario_id) {
        payload.veterinario_id = drop.veterinarioId;
      }
      const actualizado = await apiFetch<TurnoItem>(`/api/agenda/turnos/${drop.turno.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      actualizarTurno(actualizado);
      setAviso(`Turno de ${actualizado.mascota_nombre} reprogramado.`);
      setError(null);
    } catch (err) {
      setError(mensajeError(err, "No se pudo reprogramar el turno."));
    } finally {
      setIsDropping(false);
      setDrop(null);
    }
  }

  const vetDrop = drop ? veterinarios.find((v) => v.id === drop.veterinarioId) : undefined;

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Agenda</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda de turnos</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Hacé clic en un turno para ver el detalle o arrastralo para reprogramarlo."
              : "Hacé clic en un turno para ver el detalle."}
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link to="/agenda/nuevo-turno">
              <CalendarPlus />
              Nuevo turno
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => setFecha(new Date())}>
          Hoy
        </Button>
        <Button variant="ghost" size="icon" aria-label="Anterior" onClick={() => mover(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Siguiente" onClick={() => mover(1)}>
          <ChevronRight />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {tituloPeriodo(vista, fecha)}
        </span>
        {isLoading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        <div className="flex rounded-md border p-0.5">
          {VISTAS.map((v) => (
            <Button
              key={v.value}
              size="sm"
              variant={vista === v.value ? "default" : "ghost"}
              className="h-7"
              aria-pressed={vista === v.value}
              onClick={() => setVista(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <select
          aria-label="Filtrar por profesional"
          value={vetFiltro}
          onChange={(e) => setVetFiltro(e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los profesionales</option>
          {veterinarios.map((v) => (
            <option key={v.id} value={String(v.id)}>
              {v.nombre} {v.apellido}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="mostrar_cancelados"
            checked={mostrarCancelados}
            onCheckedChange={(checked) => setMostrarCancelados(checked === true)}
          />
          <Label htmlFor="mostrar_cancelados" className="text-sm font-normal">
            Mostrar cancelados
          </Label>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {aviso ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <span>{aviso}</span>
          <button type="button" className="text-xs underline" onClick={() => setAviso(null)}>
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="agenda-calendar rounded-2xl border bg-card p-2 shadow-sm">
        <DnDCalendar
          localizer={localizer}
          culture="es"
          messages={MENSAJES}
          date={fecha}
          view={vista}
          views={["day", "week", "agenda"]}
          onNavigate={(nueva) => setFecha(nueva)}
          onView={(v) => setVista(v as VistaAgenda)}
          toolbar={false}
          events={eventos}
          resources={recursos}
          resourceIdAccessor={(r) => r.id}
          resourceTitleAccessor={(r) => r.title}
          step={horario?.duracion_modulo_min ?? 30}
          timeslots={1}
          min={min}
          max={max}
          scrollToTime={min}
          length={30}
          selectable={canCreate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(e) => setSeleccionado(e.turno)}
          draggableAccessor={(e) => puedeArrastrar(e.turno, permisos)}
          resizable={false}
          onEventDrop={handleEventDrop}
          eventPropGetter={(e) => ({ className: `turno-evento ${ESTADO_CLASES[e.turno.estado]}` })}
          slotPropGetter={(date) =>
            estaEnHorario(date, horario) ? {} : { className: "rbc-slot-cerrado" }
          }
          components={{ event: EventoTurno, agenda: { event: EventoLista } }}
          formats={{
            timeGutterFormat: "HH:mm",
            eventTimeRangeFormat: ({ start, end }) =>
              `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`,
            agendaTimeRangeFormat: ({ start, end }) =>
              `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`,
            agendaDateFormat: (d) => format(d, "EEE d MMM", { locale: es }),
            dayFormat: (d) => format(d, "EEE d", { locale: es }),
          }}
          style={{ height: "calc(100vh - 290px)", minHeight: 560 }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {LEYENDA.map((estado) => (
          <span key={estado} className="flex items-center gap-1.5">
            <span className={`turno-dot ${ESTADO_CLASES[estado]}`} />
            {ESTADO_LABEL[estado]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="turno-dot rbc-slot-cerrado border" />
          Fuera de horario
        </span>
      </div>

      <TurnoDetalleSheet
        turno={seleccionado}
        permisos={permisos}
        onClose={() => setSeleccionado(null)}
        onChanged={(t) => {
          actualizarTurno(t);
          setAviso(`Turno de ${t.mascota_nombre}: ${ESTADO_LABEL[t.estado].toLowerCase()}.`);
        }}
        onReprogramar={(t) => {
          setSeleccionado(null);
          setReprogramando(t);
        }}
      />

      <ReprogramarDialog
        turno={reprogramando}
        veterinarios={veterinarios}
        tipos={tipos}
        onClose={() => setReprogramando(null)}
        onDone={(t) => {
          setReprogramando(null);
          setRecarga((n) => n + 1);
          setAviso(`Turno de ${t.mascota_nombre} reprogramado.`);
        }}
      />

      <Dialog open={drop !== null} onOpenChange={(open) => (!open ? setDrop(null) : undefined)}>
        <DialogContent>
          {drop ? (
            <>
              <DialogHeader>
                <DialogTitle>Reprogramar turno</DialogTitle>
                <DialogDescription>
                  ¿Mover el turno de {drop.turno.mascota_nombre} al{" "}
                  {format(drop.inicio, "EEEE d 'de' MMMM, HH:mm", { locale: es })} hs
                  {vetDrop && drop.veterinarioId !== drop.turno.veterinario_id
                    ? ` con ${vetDrop.nombre} ${vetDrop.apellido}`
                    : ""}
                  ?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" disabled={isDropping} onClick={() => setDrop(null)}>
                  Volver
                </Button>
                <Button disabled={isDropping} onClick={() => void confirmarDrop()}>
                  {isDropping ? <Loader2 className="animate-spin" /> : null}
                  Reprogramar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
