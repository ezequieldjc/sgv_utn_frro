import React from "react";
import { Loader2 } from "lucide-react";

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
import { apiFetch } from "@/lib/api";
import { fechaIso, horaLabel, inicioPreseleccionado, mensajeError } from "@/lib/agenda";
import type {
  DisponibilidadResponse,
  FranjaDisponible,
  TipoTurnoOpcion,
  TurnoItem,
  TurnoReprogramarPayload,
  VeterinarioOpcion,
} from "@/types/agenda";
import { FranjasGrid } from "./franjas-grid";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

/** Solo envía los campos que cambiaron respecto del turno original. */
export function buildReprogramarPayload(
  turno: Pick<TurnoItem, "fecha_hora_inicio" | "veterinario_id" | "tipo_turno_id">,
  cambios: { fecha_hora_inicio: string; veterinario_id: number; tipo_turno_id: number },
): TurnoReprogramarPayload {
  const payload: TurnoReprogramarPayload = {};
  if (new Date(cambios.fecha_hora_inicio).getTime() !== new Date(turno.fecha_hora_inicio).getTime()) {
    payload.fecha_hora_inicio = cambios.fecha_hora_inicio;
  }
  if (cambios.veterinario_id !== turno.veterinario_id) {
    payload.veterinario_id = cambios.veterinario_id;
  }
  if (cambios.tipo_turno_id !== turno.tipo_turno_id) {
    payload.tipo_turno_id = cambios.tipo_turno_id;
  }
  return payload;
}

interface Props {
  turno: TurnoItem | null;
  veterinarios: VeterinarioOpcion[];
  tipos: TipoTurnoOpcion[];
  onClose: () => void;
  onDone: (turno: TurnoItem) => void;
}

export function ReprogramarDialog({ turno, veterinarios, tipos, onClose, onDone }: Props) {
  const [fecha, setFecha] = React.useState("");
  const [veterinarioId, setVeterinarioId] = React.useState("");
  const [tipoId, setTipoId] = React.useState("");
  const [inicio, setInicio] = React.useState("");
  const [franjas, setFranjas] = React.useState<FranjaDisponible[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!turno) {
      return;
    }
    setFecha(fechaIso(new Date(turno.fecha_hora_inicio)));
    setVeterinarioId(String(turno.veterinario_id));
    setTipoId(String(turno.tipo_turno_id));
    setInicio("");
    setError(null);
  }, [turno]);

  React.useEffect(() => {
    if (!turno || !fecha || !veterinarioId || !tipoId) {
      setFranjas([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          veterinario_id: veterinarioId,
          tipo_turno_id: tipoId,
          fecha,
          mascota_id: String(turno.mascota_id),
          excluir_turno_id: String(turno.id),
        });
        const data = await apiFetch<DisponibilidadResponse>(
          `/api/agenda/disponibilidad?${params.toString()}`,
        );
        if (!cancelled) {
          setFranjas(data.franjas);
          setInicio((prev) => inicioPreseleccionado(data.franjas, prev));
        }
      } catch (err) {
        if (!cancelled) {
          setFranjas([]);
          setError(mensajeError(err, "No se pudo consultar la disponibilidad."));
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
  }, [turno, fecha, veterinarioId, tipoId]);

  if (!turno) {
    return null;
  }
  const original = turno;

  async function guardar() {
    if (!inicio) {
      setError("Elegí un horario disponible.");
      return;
    }
    const payload = buildReprogramarPayload(original, {
      fecha_hora_inicio: inicio,
      veterinario_id: Number(veterinarioId),
      tipo_turno_id: Number(tipoId),
    });
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const actualizado = await apiFetch<TurnoItem>(`/api/agenda/turnos/${original.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onDone(actualizado);
    } catch (err) {
      setError(mensajeError(err, "No se pudo reprogramar el turno."));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
          <DialogDescription>
            {original.mascota_nombre} · actualmente{" "}
            {new Date(original.fecha_hora_inicio).toLocaleDateString("es-AR")}{" "}
            {horaLabel(original.fecha_hora_inicio)} hs. El turno conserva su estado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rep_fecha">Fecha</Label>
            <Input
              id="rep_fecha"
              type="date"
              min={fechaIso(new Date())}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep_vet">Profesional</Label>
            <select
              id="rep_vet"
              value={veterinarioId}
              onChange={(e) => setVeterinarioId(e.target.value)}
              className={selectClass}
            >
              {veterinarios.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.nombre} {v.apellido}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rep_tipo">Tipo</Label>
            <select
              id="rep_tipo"
              value={tipoId}
              onChange={(e) => setTipoId(e.target.value)}
              className={selectClass}
            >
              {tipos.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.nombre} ({t.duracion_min} min)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Horarios</Label>
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando horarios…
            </p>
          ) : franjas.length === 0 ? (
            <p className="text-sm text-muted-foreground">La clínica no atiende ese día.</p>
          ) : (
            <FranjasGrid
              franjas={franjas}
              seleccionada={inicio}
              onSelect={setInicio}
              className="max-h-64 overflow-auto sm:grid-cols-3"
            />
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={isSaving} onClick={onClose}>
            Volver
          </Button>
          <Button disabled={isSaving || !inicio} onClick={() => void guardar()}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
