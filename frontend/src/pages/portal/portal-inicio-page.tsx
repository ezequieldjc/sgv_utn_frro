import { Link } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { PERMISO_PEDIR_TURNO } from "@/lib/portal";
import type { PortalMascota, PortalTurnosResponse } from "@/types/portal";

import {
  Cargando,
  EncabezadoPortal,
  ErrorPortal,
  MascotaCard,
  TurnoFila,
  usePortal,
  Vacio,
} from "./portal-componentes";

const TURNOS_EN_INICIO = 3;

export default function PortalInicioPage() {
  const { usuario, permisos } = useAuth();
  const puedePedir = permisos.includes("*") || permisos.includes(PERMISO_PEDIR_TURNO);
  const mascotas = usePortal<PortalMascota[]>("/api/portal/mascotas", "tus mascotas");
  const turnos = usePortal<PortalTurnosResponse>("/api/portal/turnos", "tus turnos");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <EncabezadoPortal
        titulo={usuario?.nombre ? `Hola, ${usuario.nombre}` : "Hola"}
        subtitulo="Acá ves a tus mascotas, su historia clínica, tus turnos y tus compras."
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Mis mascotas</h2>
        {mascotas.cargando ? <Cargando /> : null}
        {mascotas.error ? <ErrorPortal mensaje={mascotas.error} /> : null}
        {mascotas.data && mascotas.data.length === 0 ? (
          <Vacio>Todavía no tenés mascotas registradas en la clínica.</Vacio>
        ) : null}
        {mascotas.data?.map((m) => <MascotaCard key={m.id} mascota={m} />)}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Próximos turnos</h2>
          <div className="flex gap-4 text-sm">
            {puedePedir ? (
              <Link to="/portal/turnos/nuevo" className="text-primary hover:underline">
                Pedir turno
              </Link>
            ) : null}
            <Link to="/portal/turnos" className="text-primary hover:underline">
              Ver todos
            </Link>
          </div>
        </div>
        {turnos.cargando ? <Cargando /> : null}
        {turnos.error ? <ErrorPortal mensaje={turnos.error} /> : null}
        {turnos.data && turnos.data.proximos.length === 0 ? (
          <Vacio>No tenés turnos próximos.</Vacio>
        ) : null}
        {turnos.data?.proximos.slice(0, TURNOS_EN_INICIO).map((t) => (
          <TurnoFila key={t.id} turno={t} />
        ))}
      </section>
    </div>
  );
}
