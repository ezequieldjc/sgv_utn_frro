Create a responsive App Shell component in `components/app-shell.tsx` using React, Tailwind CSS, Lucide icons, and Shadcn UI components.

### Props Definition:
- Accept `clinicName?: string` (default: "Mi Veterinaria") to dynamically render the business name from DB configuration.
- Accept `children: React.ReactNode` for rendering page content.

### Requirements & Imports:
1. **Shadcn UI**: Use `@/components/ui/button`, `@/components/ui/input`, `@/components/ui/dropdown-menu`, `@/components/ui/avatar`.
2. **Icons**: Use `PawPrint`, `Calendar`, `Users`, `Stethoscope`, `Package`, `Settings`, `Search`, `Plus`, `ChevronDown`, `LogOut`, `User`, `Menu` from `lucide-react`.
3. **Theme & Local Assets**:
   - Use standard Shadcn CSS variables (`bg-background`, `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`).
   - Use local image `/logo.png` for business logo inside sidebar header (fallback to `PawPrint` icon if image fails).
   - Include `<ModeToggle />` component in the header right area.

### Component Structure:

#### 1. Sidebar (Left - Width 256px):
- **Header**: Flex layout with local image `/logo.png` (size `h-8 w-8 object-contain`) + dynamic `{clinicName}` text (`font-bold text-sm`).
- **Navigation Menu** (Grouped into sections):
  - **GESTIÓN**:
    - **Pacientes**: Collapsible/sub-items -> "Consulta", "Alta de Paciente".
    - **Dueños**: Collapsible/sub-items -> "Consulta", "Alta de Dueño".
    - **Turnos**: Collapsible/sub-items -> "Calendario", "Nuevo Turno".
    - **Atenciones**: Collapsible/sub-items -> "Historial", "Nueva Atención".
  - **INVENTARIO**:
    - **Stock**: Link -> "Stock e Insumos".
  - **SISTEMA**:
    - **Configuración**: Link -> "Configuración".
    - **Usuarios**: Link -> "Usuarios".
- **Footer**: Single "Cerrar Sesión" button with `LogOut` icon and destructive hover state.

#### 2. Header (Top Horizontal):
- **Left**: Sidebar toggle button (`Menu` icon) + Breadcrumbs text (`Pacientes / Consulta`).
- **Center**: Global search bar with `Search` icon + placeholder "Buscar por mascota, DNI del dueño o N° de chip..." + `<kbd>Ctrl K</kbd>` badge.
- **Right**:
  - Primary button: `+ Nueva Atención` (`bg-primary text-primary-foreground`).
  - Mode toggle button `<ModeToggle />`.
  - User Dropdown (`DropdownMenu`):
    - Trigger: Avatar with initials "DP" + "Dr. Pérez" text + `ChevronDown`.
    - Menu Items: "Mi Perfil", "Configuración", Divider, "Cerrar Sesión" (destructive text).

#### 3. Main Area:
- `<main className="flex-1 overflow-y-auto p-6 bg-background">` rendering `{children}`.

Produce clean, modular, production-ready TSX code. Do not write explanation prose.