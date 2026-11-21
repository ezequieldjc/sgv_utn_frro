import React from "react";
import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { PERMISO_PEDIR_TURNO, turnoLabel } from "@/lib/portal";
import type { PortalTurno, PortalTurnosResponse } from "@/types/portal";

import {
  Cargando,
  EncabezadoPortal,
  ErrorPortal,
  TurnoFila,
  usePortal,
  Vacio,
} from "./portal-componentes";

function mensajeCancelar(error: unknown): string {
  const detalle = (error as { body?: { detalle?: unknown } })?.body?.detalle;
  return typeof detalle === "string"
    ? detalle
    : "No pudimos cancelar el turno. Probá de nuevo o comunicate con la clínica.";
}

export default function MisTurnosPage() {
  const { permisos } = useAuth();
  const puedePedir = permisos.includes("*") || permisos.includes(PERMISO_PEDIR_TURNO);
  // Cambiar la clave vuelve a pedir el listado después de cancelar.
  const [version, setVersion] = React.useState(0);
  const { data, error, cargando } = usePortal<PortalTurnosResponse>(
    `/api/portal/turnos?v=${version}`,
    "tus turnos",
  );

  const [aCancelar, setACancelar] = React.useState<PortalTurno | null>(null);
  const [cancelando, setCancelando] = React.useState(false);
  const [errorCancelar, setErrorCancelar] = React.useState<string | null>(null);

  async function cancelar() {
    if (!aCancelar) {
      return;
    }
    setCancelando(true);
    setErrorCancelar(null);
    try {
      await apiFetch<PortalTurno>(`/api/portal/turnos/${aCancelar.id}/cancelar`, {
        method: "POST",
      });
      setACancelar(null);
      setVersion((v) => v + 1);
    } catch (err: unknown) {
      setErrorCancelar(mensajeCancelar(err));
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <EncabezadoPortal titulo="Mis turnos" subtitulo="Los turnos de todas tus mascotas." />
        {puedePedir ? (
          <Button asChild>
            <Link to="/portal/turnos/nuevo">
              <CalendarPlus className="mr-2 size-4" />
              Pedir turno
            </Link>
          </Button>
        ) : null}
      </div>

      {cargando && !data ? <Cargando /> : null}
      {error ? <ErrorPortal mensaje={error} /> : null}
      {data ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Próximos</h2>
            {data.proximos.length === 0 ? <Vacio>No tenés turnos próximos.</Vacio> : null}
            {data.proximos.map((t) => (
              <TurnoFila key={t.id} turno={t}>
                {t.cancelable && puedePedir ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setErrorCancelar(null);
                      setACancelar(t);
                    }}
                  >
                    Cancelar turno
                  </Button>
                ) : null}
                {t.estado === "confirmado" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Confirmado por la clínica. Si no podés ir, comunicate con la clínica para
                    cancelarlo.
                  </p>
                ) : null}
                {t.estado === "solicitado" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pendiente de confirmación de la clínica.
                  </p>
                ) : null}
              </TurnoFila>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Anteriores</h2>
            {data.anteriores.length === 0 ? <Vacio>Todavía no hay turnos anteriores.</Vacio> : null}
            {data.anteriores.map((t) => (
              <TurnoFila key={t.id} turno={t} />
            ))}
          </section>
        </>
      ) : null}

      {aCancelar ? (
        <Dialog open onOpenChange={(open) => (!open ? setACancelar(null) : undefined)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>¿Cancelar el turno?</DialogTitle>
              <DialogDescription>
                {aCancelar.tipo_turno_nombre} de {aCancelar.mascota_nombre},{" "}
                <span className="capitalize">{turnoLabel(aCancelar.fecha_hora_inicio)}</span>. El
                horario queda libre para otra persona.
              </DialogDescription>
            </DialogHeader>
            {errorCancelar ? <ErrorPortal mensaje={errorCancelar} /> : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setACancelar(null)} disabled={cancelando}>
                Volver
              </Button>
              <Button
                variant="destructive"
                onClick={() => void cancelar()}
                disabled={cancelando}
              >
                {cancelando ? "Cancelando…" : "Sí, cancelar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
