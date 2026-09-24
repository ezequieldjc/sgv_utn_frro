import { Link, useSearchParams } from "react-router-dom";

export default function ConsultasHistorialPage() {
  const [searchParams] = useSearchParams();
  const mascotaId = searchParams.get("mascota_id");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial de Consultas</h1>
        <p className="text-sm text-muted-foreground">
          {mascotaId
            ? `Historial de la mascota #${mascotaId} (en construcción).`
            : "Historial de consultas (en construcción)."}
        </p>
      </div>
      <Link to="/mascotas" className="text-sm font-medium text-primary underline">
        Volver al listado de mascotas
      </Link>
    </div>
  );
}
