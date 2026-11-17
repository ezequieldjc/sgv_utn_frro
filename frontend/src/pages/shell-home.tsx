import React from 'react';

import { useAuth } from '@/context/auth-context';
import { tienePortalComoInicio } from '@/lib/portal';
import PortalInicioPage from '@/pages/portal/portal-inicio-page';

export default function ShellHome() {
  const { permisos } = useAuth();
  // Un cliente entra directo a su portal.
  if (tienePortalComoInicio(permisos)) {
    return <PortalInicioPage />;
  }
  return (
    <div>
      <h1 className="text-2xl font-bold">Bienvenido</h1>
      <p className="mt-2 text-sm text-muted-foreground">Seleccione una opción del menú para comenzar.</p>
    </div>
  );
}
