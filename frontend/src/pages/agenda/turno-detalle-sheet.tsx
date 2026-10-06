import React from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleSlash,
  Loader2,
  Phone,
  Stethoscope,
  UserX,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import {
  CANAL_LABEL,
  ESTADO_BADGE,
  ESTADO_LABEL,
  accionesDisponibles,
  horaLabel,
  mensajeError,
  type AccionTurno,
} from "@/lib/agenda";
import type { TurnoItem } from "@/types/agenda";

type AccionConConfirmacion = Exclude<AccionTurno, "confirmar" | "reprogramar">;

const CONFIRMACIONES: Record<AccionConConfirmacion, { titulo: string; texto: string; cta: string }> = {
  realizado: {
    titulo: "Marcar como realizado",
    texto: "El turno quedará registrado como atendido.",
    cta: "Marcar realizado",
  },
  no_asistio: {
    titulo: "Marcar como no asistió",
    texto: "El turno quedará registrado como ausencia del paciente y liberará el horario.",
    cta: "Marcar no asistió",
  },
  cancelar: {
    titulo: "Cancelar turno",
    texto: "El turno se cancelará y el horario quedará libre. Esta acción no se puede deshacer.",
    cta: "Cancelar turno",
  },
};

interface Props {
  turno: TurnoItem | null;
  permisos: string[];
  onClose: () => void;
  onChanged: (turno: TurnoItem) => void;
  onReprogramar: (turno: TurnoItem) => void;
}

export function TurnoDetalleSheet({ turno, permisos, onClose, onChanged, onReprogramar }: Props) {
  const [pendiente, setPendiente] = React.useState<AccionConConfirmacion | null>(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setPendiente(null);
  }, [turno?.id]);

  if (!turno) {
    return null;
  }
  const actual = turno;
  const acciones = accionesDisponibles(actual, permisos);
  const inicio = new Date(actual.fecha_hora_inicio);

  async function ejecutar(accion: AccionTurno) {
    setIsWorking(true);
    setError(null);
    try {
      let actualizado: TurnoItem;
      if (accion === "cancelar") {
        actualizado = await apiFetch<TurnoItem>(`/api/agenda/turnos/${actual.id}/cancelar`, {
          method: "POST",
        });
      } else {
        const estado = accion === "confirmar" ? "confirmado" : accion;
        actualizado = await apiFetch<TurnoItem>(`/api/agenda/turnos/${actual.id}/estado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        });
      }
      setPendiente(null);
      onChanged(actualizado);
    } catch (err) {
      setError(mensajeError(err, "No se pudo actualizar el turno."));
      setPendiente(null);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <SheetContent className="flex w-full flex-col gap-6 sm:max-w-md">
          <SheetHeader className="space-y-2 text-left">
            <span
              className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[actual.estado]}`}
            >
              {ESTADO_LABEL[actual.estado]}
            </span>
            <SheetTitle className="text-xl">{actual.mascota_nombre}</SheetTitle>
            <SheetDescription>
              {actual.tipo_turno_nombre} ·{" "}
              {inicio.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}{" "}
              · {horaLabel(actual.fecha_hora_inicio)} a {horaLabel(actual.fecha_hora_fin)} hs
            </SheetDescription>
          </SheetHeader>

          <dl className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
            <div className="flex items-start gap-3">
              <Stethoscope className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Profesional</dt>
                <dd className="font-medium">
                  {actual.veterinario_nombre} {actual.veterinario_apellido}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Tutor</dt>
                <dd className="font-medium">
                  {actual.tutor_nombre} {actual.tutor_apellido}
                </dd>
                {actual.tutor_celular ? (
                  <dd className="text-muted-foreground">{actual.tutor_celular}</dd>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">Canal de origen</dt>
                <dd className="font-medium">{CANAL_LABEL[actual.canal_origen]}</dd>
              </div>
            </div>
          </dl>

          {error ? (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {acciones.length > 0 ? (
            <div className="mt-auto grid gap-2">
              {acciones.includes("confirmar") ? (
                <Button disabled={isWorking} onClick={() => void ejecutar("confirmar")}>
                  {isWorking ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Confirmar turno
                </Button>
              ) : null}
              {acciones.includes("realizado") ? (
                <Button disabled={isWorking} onClick={() => setPendiente("realizado")}>
                  <CheckCircle2 />
                  Marcar realizado
                </Button>
              ) : null}
              {acciones.includes("no_asistio") ? (
                <Button variant="outline" disabled={isWorking} onClick={() => setPendiente("no_asistio")}>
                  <UserX />
                  No asistió
                </Button>
              ) : null}
              {acciones.includes("reprogramar") ? (
                <Button variant="outline" disabled={isWorking} onClick={() => onReprogramar(actual)}>
                  <CalendarClock />
                  Reprogramar
                </Button>
              ) : null}
              {acciones.includes("cancelar") ? (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isWorking}
                  onClick={() => setPendiente("cancelar")}
                >
                  <XCircle />
                  Cancelar turno
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="mt-auto flex items-center gap-2 text-sm text-muted-foreground">
              <CircleSlash className="size-4" />
              Este turno no tiene acciones disponibles.
            </p>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={pendiente !== null} onOpenChange={(open) => (!open ? setPendiente(null) : undefined)}>
        <DialogContent>
          {pendiente ? (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIRMACIONES[pendiente].titulo}</DialogTitle>
                <DialogDescription>
                  {actual.mascota_nombre} · {horaLabel(actual.fecha_hora_inicio)} hs.{" "}
                  {CONFIRMACIONES[pendiente].texto}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" disabled={isWorking} onClick={() => setPendiente(null)}>
                  Volver
                </Button>
                <Button
                  variant={pendiente === "cancelar" ? "destructive" : "default"}
                  disabled={isWorking}
                  onClick={() => void ejecutar(pendiente)}
                >
                  {isWorking ? <Loader2 className="animate-spin" /> : null}
                  {CONFIRMACIONES[pendiente].cta}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
