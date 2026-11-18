import { Link } from "react-router-dom";
import { Pill, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { hasPermission } from "@/lib/consultas";

/**
 * En el prototipo no hay una receta suelta: sale de las indicaciones de la consulta firmada.
 * La receta electrónica con ítems, matrícula y firma digital es de la Fase 2 (docs/fase2_diseno.md).
 */
export default function NuevaRecetaPage() {
  const { permisos } = useAuth();
  const canConsulta = hasPermission(permisos, "consultas:crear");
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Pill className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Recetas</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva receta</h1>
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-5 text-sm shadow-sm">
        <p>
          La receta sale de la consulta: lo que se dicta como indicación («Indico…», dosis, cada
          cuántas horas, control) queda en el campo <strong>Tratamiento</strong> de la ficha. Al
          firmar la consulta, la receta queda disponible en PDF desde la consulta y desde el
          historial de recetas.
        </p>
        <p className="text-muted-foreground">
          La receta electrónica con varios medicamentos, matrícula, firma digital y código de
          validación es parte de la Fase 2.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {canConsulta ? (
            <Button asChild>
              <Link to="/consultas/nueva">
                <Stethoscope />
                Nueva consulta
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/recetas/historial">Historial de recetas</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
