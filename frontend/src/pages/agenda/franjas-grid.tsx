import React from "react";
import { Ban, Clock, Info, PawPrint, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MOTIVO_LABEL, franjaLabel, resumenFranjas } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { FranjaDisponible, MotivoNoDisponible } from "@/types/agenda";

const MOTIVO_ICONO: Record<MotivoNoDisponible, React.ComponentType<{ className?: string }>> = {
  PASADO: Clock,
  EXCEDE_HORARIO: Ban,
  OCUPADO_VETERINARIO: Stethoscope,
  OCUPADO_MASCOTA: PawPrint,
};

interface Props {
  franjas: FranjaDisponible[];
  seleccionada: string;
  onSelect: (fechaHoraInicio: string) => void;
  className?: string;
}

/**
 * Grilla con todos los módulos del día: los libres se pueden elegir; los no disponibles se
 * muestran rayados con su motivo (tooltip al pasar el mouse y detalle al hacer clic).
 */
export function FranjasGrid({ franjas, seleccionada, onSelect, className }: Props) {
  const [detalle, setDetalle] = React.useState<FranjaDisponible | null>(null);
  const { libres, noDisponibles } = resumenFranjas(franjas);

  React.useEffect(() => {
    setDetalle(null);
  }, [franjas]);

  const IconoDetalle = detalle?.motivo ? MOTIVO_ICONO[detalle.motivo] : Info;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {libres} {libres === 1 ? "libre" : "libres"} · {noDisponibles} no{" "}
        {noDisponibles === 1 ? "disponible" : "disponibles"}
        {noDisponibles > 0 ? " — hacé clic en uno no disponible para ver el motivo." : ""}
      </p>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
        {franjas.map((franja) => {
          if (franja.disponible) {
            const activa = seleccionada === franja.fecha_hora_inicio;
            return (
              <Button
                key={franja.fecha_hora_inicio}
                type="button"
                size="sm"
                variant={activa ? "default" : "outline"}
                aria-pressed={activa}
                className="h-auto min-h-9 py-1.5"
                onClick={() => {
                  setDetalle(null);
                  onSelect(franja.fecha_hora_inicio);
                }}
              >
                {franjaLabel(franja)}
              </Button>
            );
          }
          const Icono = franja.motivo ? MOTIVO_ICONO[franja.motivo] : Info;
          const abierta = detalle?.fecha_hora_inicio === franja.fecha_hora_inicio;
          return (
            <Button
              key={franja.fecha_hora_inicio}
              type="button"
              size="sm"
              variant="outline"
              aria-disabled="true"
              title={franja.detalle ?? undefined}
              className={cn(
                "franja-no-disponible h-auto min-h-9 flex-col gap-0 py-1.5 text-muted-foreground hover:text-muted-foreground",
                abierta && "ring-1 ring-ring",
              )}
              onClick={() => setDetalle(abierta ? null : franja)}
            >
              <span className="line-through decoration-1">{franjaLabel(franja)}</span>
              <span className="flex items-center gap-1 text-[10px] font-normal">
                <Icono className="!size-3" />
                {franja.motivo ? MOTIVO_LABEL[franja.motivo] : "No disponible"}
              </span>
            </Button>
          );
        })}
      </div>
      {libres === 0 && franjas.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          No quedan horarios libres ese día para esta combinación.
        </p>
      ) : null}
      {detalle ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border bg-muted/50 px-4 py-3 text-sm"
        >
          <IconoDetalle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-medium">{franjaLabel(detalle)}</span> — {detalle.detalle}
          </span>
        </div>
      ) : null}
    </div>
  );
}
