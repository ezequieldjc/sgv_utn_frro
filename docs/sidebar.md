Create a responsive App Shell component in `src/components/app-shell.tsx` for the React + Vite SPA using React, Tailwind CSS, Lucide icons, and Shadcn UI components.

### Props Definition:
- Accept `clinicName?: string` (default: "Mi Veterinaria") to dynamically render the business name. The AppShell is a pure presentation component and must NOT fetch this data itself.
- Accept `children: React.ReactNode` for rendering page content.

### Requirements & Imports:
1. **Shadcn UI**: Use `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/dropdown-menu`, `@/components/ui/avatar`.
2. **Icons**: Use `PawPrint`, `Calendar`, `Users`, `Stethoscope`, `Package`, `Settings`, `Search`, `Plus`, `ChevronDown`, `LogOut`, `User`, `Menu` from `lucide-react`.
3. **Theme & Local Assets**:
   - Use standard Shadcn CSS variables (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`).
   - Use local image `/logo.png` for business logo inside sidebar header (fallback to `PawPrint` icon if image fails).
   - Include `<ModeToggle />` component in the header right area.

### Enrutamiento y protección de rutas:
- Implementar `<ProtectedRoute>` como wrapper de React Router. Al montar, si no hay estado de sesión ya hidratado, llama a `GET /api/auth/me`. HTTP 200 → hidrata usuario y permisos. Simultáneamente (o en paralelo), llama a `GET /api/config/public` para obtener `razon_social`. Luego, renderiza `children` pasando `clinicName` al layout. HTTP 401 → redirige a `/login`.
- Este shell (`app-shell.tsx`) solo se renderiza dentro de rutas envueltas por
  `<ProtectedRoute>`.

### Layout Rules:
- This shell is used only after authentication succeeds.
- The main area starts empty for now: `children` is rendered inside the central content area, but there is no default dashboard content.
- Sidebar items are filtered by permissions, not by hardcoded role names.
- The backend loads the user's role and permissions at login time; the frontend receives
  them via the login response JSON and via `GET /api/auth/me` (not by decoding the JWT,
  which lives in an HttpOnly cookie and is not readable by JS).

### Permission Mapping Reference:
- Use exact permissions in `recurso:accion` format as defined in the database.
- Parent sections in the sidebar should only be rendered if the user has AT LEAST ONE of the permissions required for its children.
- Global Wildcard Rule: If the user's permissions array includes the wildcard `*`, they implicitly have access to ALL sidebar sections and internal actions, bypassing any specific `:read` or `:create` checks.
- Do not hardcode which role receives which permission in this prompt; that mapping lives in the database.


### Navigation Permission Contract:
- Treat each top-level sidebar section as an expandable accordion/group.
- The visibility of the parent group is determined by a `.some()` check against the permissions of its child links.
- Every clickable link must strictly validate against the specific permission string mapped to it. If the permission is missing, the link is not rendered.

### Component Structure:

#### 1. Sidebar (Left - Width 256px):
- **Header**: Flex layout with local image `/logo.png` (size `h-8 w-8 object-contain`) + dynamic `{clinicName}` text (`font-bold text-sm`).
- **Navigation Menu** (Grouped into sections):
  - **CONSULTAS**:
    - Collapsible/sub-items: 
      - "Nueva Consulta" (requires `consultas:crear`)
      - "Historial de Consultas" (requires `consultas:ver_historial`)
      - "Historia Clínica" (requires `consultas:ver_historia_clinica`)
  - **RECETAS**:
    - Collapsible/sub-items:
      - "Nueva Receta" (requires `recetas:crear`)
      - "Historial de Recetas" (requires `recetas:ver_historial`)
  - **AGENDA**:
    - Collapsible/sub-items:
      - "Nuevo Turno" (requires `agenda:crear_turno`)
      - "Ver Agenda" (requires `agenda:ver`)
  - **MASCOTAS Y CLIENTES**:
    - Collapsible/sub-items:
      - "Nueva Mascota" (requires `mascotas:crear`)
      - "Nuevo Cliente" (requires `clientes:crear`)
      - "Listado de Mascotas" (requires `mascotas:ver_listado`)
      - "Listado de Clientes" (requires `clientes:ver_listado`)
  - **STOCK**:
    - Collapsible/sub-items:
      - "Alta de Insumos" (requires `stock:crear_insumo`)
      - "Movimientos" (requires `stock:registrar_movimiento`)
      - "Análisis de Stock" (requires `stock:ver_analisis`)
  - **ADMIN**:
    - Collapsible/sub-items:
      - "Usuarios" (requires `usuarios:ver`)
      - "Roles y Permisos" (requires `roles:ver`)
      - "Parámetros" (requires `parametros:ver`)
      - "Auditoría" (requires `auditoria:ver`)
- **Footer**: Single "Cerrar Sesión" button with `LogOut` icon and destructive hover state. On click: `POST /api/auth/logout`, then redirect to `/login`.

#### 2. Header (Top Horizontal):
- **Left**: Sidebar toggle button (`Menu` icon) + Dynamic Breadcrumbs component.
  - Use `useLocation()` from `react-router-dom` to read the current pathname.
  - Dynamically map the URL segments to readable labels (e.g., if path is `/pacientes/consulta`, render `Pacientes / Consulta`).
- **Center**: Global search bar with `Search` icon + placeholder "Buscar por mascota, DNI del dueño o N° de chip..." + `<kbd>Ctrl K</kbd>` badge. *(Note: Render as visual mockup only. No real search behavior yet).*
- **Right**:
  - Primary button: `+ Nueva Consulta` (`bg-primary text-primary-foreground`). *(Note: Render as visual mockup only, but wrap it in a permission check requiring `consultas:crear`)*.
  - Mode toggle button `<ModeToggle />`.
  - User Dropdown (`DropdownMenu`):
    - Trigger: Avatar con las iniciales y el nombre completo del usuario autenticado
      (`persona.nombre` + `persona.apellido`, obtenidos de la sesión — nunca hardcodeado) +
      `ChevronDown`. (Ejemplo ilustrativo del formato: iniciales "DP", texto "Dr. Pérez".)
    - Menu Items: 
      - "Mi Perfil" (Links to `/perfil`. Does not require any explicit permission, this route is inherently available to all authenticated users).
      - "Configuración"
      - Divider
      - "Cerrar Sesión" (destructive text...)

#### 3. Main Area:
- `<main className="flex-1 overflow-y-auto p-6 bg-background">` rendering `{children}`.

Produce clean, modular, production-ready TSX code. Do not write explanation prose.
