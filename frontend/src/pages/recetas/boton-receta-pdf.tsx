import React from "react";
import { FileDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiDescargar } from "@/lib/api";
import { mensajeErrorApi } from "@/lib/vacunas";

/** Baja el PDF de la receta de una consulta firmada (con la sesión del usuario). */
export function BotonRecetaPdf({
  consultaId,
  variant = "outline",
  size = "sm",
  onError,
}: {
  consultaId: number;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
  onError: (mensaje: string) => void;
}) {
  const [bajando, setBajando] = React.useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={bajando}
      onClick={async (event) => {
        event.stopPropagation();
        setBajando(true);
        try {
          await apiDescargar(`/api/consultas/${consultaId}/receta.pdf`, `receta-${consultaId}.pdf`);
        } catch (err) {
          onError(mensajeErrorApi(err, "No se pudo generar la receta."));
        } finally {
          setBajando(false);
        }
      }}
    >
      {bajando ? <Loader2 className="animate-spin" /> : <FileDown />}
      Receta (PDF)
    </Button>
  );
}
