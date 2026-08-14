import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  LogOut,
  Package,
  PawPrint,
  Pill,
  Plus,
  Search,
  Settings,
  Shield,
  Stethoscope,
  User,
  Users,
} from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/context/auth-context";

interface NavLink {
  to: string;
  label: string;
  permiso: string;
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavLink[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Consultas",
    icon: Stethoscope,
    items: [
      { to: "/consultas/nueva", label: "Nueva Consulta", permiso: "consultas:crear" },
      {
        to: "/consultas/historial",
        label: "Historial de Consultas",
        permiso: "consultas:ver_historial",
      },
      {
        to: "/consultas/historia-clinica",
        label: "Historia Clínica",
        permiso: "consultas:ver_historia_clinica",
      },
    ],
  },
  {
    title: "Recetas",
    icon: Pill,
    items: [
      { to: "/recetas/nueva", label: "Nueva Receta", permiso: "recetas:crear" },
      {
        to: "/recetas/historial",
        label: "Historial de Recetas",
        permiso: "recetas:ver_historial",
      },
    ],
  },
  {
    title: "Agenda",
    icon: Calendar,
    items: [
      { to: "/agenda/nuevo-turno", label: "Nuevo Turno", permiso: "agenda:crear_turno" },
      { to: "/agenda", label: "Ver Agenda", permiso: "agenda:ver" },
    ],
  },
  {
    title: "Mascotas y Clientes",
    icon: Users,
    items: [
      { to: "/mascotas/nueva", label: "Nueva Mascota", permiso: "mascotas:crear" },
      { to: "/clientes/nuevo", label: "Nuevo Cliente", permiso: "clientes:crear" },
      { to: "/mascotas", label: "Listado de Mascotas", permiso: "mascotas:ver_listado" },
      { to: "/clientes", label: "Listado de Clientes", permiso: "clientes:ver_listado" },
    ],
  },
  {
    title: "Stock",
    icon: Package,
    items: [
      { to: "/stock/alta", label: "Alta de Insumos", permiso: "stock:crear_insumo" },
      {
        to: "/stock/movimientos",
        label: "Movimientos",
        permiso: "stock:registrar_movimiento",
      },
      { to: "/stock/analisis", label: "Análisis de Stock", permiso: "stock:ver_analisis" },
    ],
  },
  {
    title: "Admin",
    icon: Shield,
    items: [
      { to: "/admin/usuarios", label: "Usuarios", permiso: "usuarios:ver" },
      { to: "/admin/roles", label: "Roles y Permisos", permiso: "roles:ver" },
      { to: "/admin/parametros", label: "Parámetros", permiso: "parametros:ver" },
      { to: "/admin/auditoria", label: "Auditoría", permiso: "auditoria:ver" },
    ],
  },
];

const SEGMENT_LABELS: Record<string, string> = {
  consultas: "Consultas",
  nueva: "Nueva",
  historial: "Historial",
  "historia-clinica": "Historia Clínica",
  recetas: "Recetas",
  agenda: "Agenda",
  "nuevo-turno": "Nuevo Turno",
  mascotas: "Mascotas",
  clientes: "Clientes",
  nuevo: "Nuevo",
  stock: "Stock",
  alta: "Alta",
  movimientos: "Movimientos",
  analisis: "Análisis",
  admin: "Admin",
  usuarios: "Usuarios",
  roles: "Roles y Permisos",
  parametros: "Parámetros",
  auditoria: "Auditoría",
  perfil: "Perfil",
  configuracion: "Configuración",
};

function hasPermission(permisos: string[], permiso: string): boolean {
  if (permisos.includes("*")) {
    return true;
  }
  return permisos.includes(permiso);
}

function getVisibleItems(section: NavSection, permisos: string[]): NavLink[] {
  return section.items.filter((item) => hasPermission(permisos, item.permiso));
}

function AppBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Inicio</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink asChild>
            <Link to="/">Inicio</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`;
          const isLast = index === segments.length - 1;
          const label =
            SEGMENT_LABELS[segment] ??
            segment.charAt(0).toUpperCase() + segment.slice(1);

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function NavSectionItem({
  section,
  permisos,
}: {
  section: NavSection;
  permisos: string[];
}) {
  const location = useLocation();
  const visibleItems = getVisibleItems(section, permisos);

  if (visibleItems.length === 0) {
    return null;
  }

  const Icon = section.icon;
  const isSectionActive = visibleItems.some(
    (item) =>
      location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  );

  return (
    <Collapsible defaultOpen={isSectionActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={section.title} isActive={isSectionActive}>
            <Icon />
            <span>{section.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visibleItems.map((item) => {
              const isActive =
                location.pathname === item.to ||
                location.pathname.startsWith(`${item.to}/`);

              return (
                <SidebarMenuSubItem key={item.to}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link to={item.to}>
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function AppSidebar() {
  const { permisos, clinicName, logout } = useAuth();
  const [logoFailed, setLogoFailed] = React.useState(false);

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {logoFailed ? (
                    <PawPrint className="size-4" />
                  ) : (
                    <img
                      src="/logo.png"
                      alt=""
                      className="h-8 w-8 object-contain"
                      onError={() => setLogoFailed(true)}
                    />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-sm">
                    {clinicName || "Mi Veterinaria"}
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    Gestión veterinaria
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_SECTIONS.map((section) => (
                <NavSectionItem
                  key={section.title}
                  section={section}
                  permisos={permisos}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Cerrar sesión"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ShellHeader() {
  const { usuario, permisos, logout } = useAuth();
  const canCreateConsulta = hasPermission(permisos, "consultas:crear");
  const fullName = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ");
  const initials = `${usuario?.nombre?.[0] ?? ""}${usuario?.apellido?.[0] ?? ""}`.toUpperCase()
    || usuario?.username?.[0]?.toUpperCase()
    || "?";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <AppBreadcrumb />

      <div className="mx-auto hidden max-w-xl flex-1 px-4 lg:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            readOnly
            placeholder="Buscar por mascota, DNI del dueño o N° de chip..."
            className="h-9 bg-muted/40 pl-8 pr-16"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canCreateConsulta ? (
          <Button size="sm" className="hidden sm:inline-flex" type="button">
            <Plus className="size-4" />
            Nueva Consulta
          </Button>
        ) : null}
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[10rem] truncate text-sm md:inline">
                {fullName || usuario?.username}
              </span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {fullName || usuario?.username}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {usuario?.username}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/perfil">
                <User className="mr-2 size-4" />
                Mi Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracion">
                <Settings className="mr-2 size-4" />
                Configuración
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="mr-2 size-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export const AppShell: React.FC = () => {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ShellHeader />
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
