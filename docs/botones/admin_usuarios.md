# Especificación de Pantalla: Admin -> Usuarios (`/admin/usuarios`)

Crea la pantalla de gestión de usuarios en `src/pages/admin/usuarios-page.tsx` para la aplicación React + Vite SPA, utilizando React, TypeScript, Tailwind CSS, iconos de Lucide-react y componentes de Shadcn UI.

---

## 1. Contexto y Permisos de Seguridad
- **Protección de Ruta:** La vista completa solo debe cargarse si el usuario tiene el permiso `usuarios:ver` (o el comodín `*`)[cite: 2, 4].
- **Acciones Internas:** Los botones dentro de la pantalla deben responder a los permisos específicos correspondientes[cite: 2, 4]:
  - `+ Nuevo Usuario`: Requiere `usuarios:crear`[cite: 4].
  - Acciones en filas (Inhabilitar / Cambiar Contraseña): Requieren `usuarios:editar`[cite: 4].
  - Acción Duplicar: Requiere `usuarios:crear`[cite: 4].
  - Ver Detalle: Requiere `usuarios:ver`[cite: 4].

---

## 2. Estructura y Componentes de la Interfaz

### A. Encabezado de la Pantalla (Header)
- Título principal: `Gestión de Usuarios`
- Subtítulo/Descripción: `Administración de cuentas, roles y accesos al sistema.`

---

### B. Barra Superior de Control (Línea Horizontal)
Diseña una barra alineada horizontalmente (`flex items-center justify-between gap-4 mb-6`):

1. **Lado Izquierdo:**
   - Campo de búsqueda / filtro (`Input` de Shadcn UI con icono `Search`).
   - Placeholder: `"Buscar por nombre, apellido o usuario..."`
   - Comportamiento: Debe filtrar dinámicamente en tiempo real la tabla inferior contrastando contra `nombre y apellido` O `nombre de usuario` (coincidencia no sensible a mayúsculas/minúsculas).

2. **Lado Derecho:**
   - Botón primario: `+ Nuevo Usuario` (Icono `Plus` de Lucide).
   - Estilo: `bg-primary text-primary-foreground`.
   - Visibilidad: Renderizar solo si cuenta con el permiso `usuarios:crear`[cite: 4].

---

### C. Tabla Principal de Usuarios (`Table` de Shadcn UI)
La tabla debe ser responsive y renderizar mock data inicial para previsualizar los usuarios.

#### Columnas Requeridas:
1. **Checkbox:** `Checkbox` en el encabezado (para seleccionar todos) y en cada fila (para selección individual).
2. **Nombre y Apellido:** Texto destacado (`font-medium`) con el nombre completo de la persona (`persona.nombre` + `persona.apellido`).
3. **Nombre de Usuario:** Texto identificador (`username` / ej. `@jgonzalez`).
4. **Último Inicio de Sesión:** Fecha y hora formateada (ej. `13/08/2026 18:45 hs` o `"Nunca"` si es nuevo).
5. **Estado:** `Badge` visual:
   - `Activo` (Verde / `bg-green-100 text-green-800`).
   - `Inactivo` (Gris o Rojo / `bg-destructive/10 text-destructive`).
6. **Rol:** Texto con el nombre del rol asignado.
   - **Formato obligatorio:** Debe ser un enlace subrayado en azul (`text-blue-600 underline hover:text-blue-800 font-medium`).
   - **Navegación:** Debe apuntar a la ruta `/admin/roles/:id` (ejemplo: `/admin/roles/2`). *(Nota: Solo renderizar el hipervínculo `<Link>`, no implementar la pantalla destino aún)*.
7. **Acciones (Botones por fila / columna de herramientas):**
   Renderiza un contenedor horizontal de acciones o menú desplegable con los siguientes 4 botones identificables:
   - **Inhabilitar / Habilitar:** Botón o icono que alterna el estado visual del usuario (`usuarios:editar`)[cite: 4].
   - **Duplicar Usuario:** Botón o icono con tooltip `"Crear usuario tomando a este como plantilla"` (`usuarios:crear`)[cite: 4].
   - **Cambiar Contraseña:** Botón o icono con tooltip `"Restablecer contraseña"` (`usuarios:editar`)[cite: 4].
   - **Ver Detalle:** Botón o icono que redirige a `/admin/usuarios/:id` (`usuarios:ver`)[cite: 4].

---

## 3. Alcance de esta Entrega
- **IMPORTANTE:** En esta fase solo se debe construir la **estructura de la interfaz (Layout Shell), el filtrado local de la tabla por buscador y la representación visual de todos los botones/enlaces con sus respectivos controles de permisos**.
- No es necesario implementar la lógica real de negocio de los modales, llamadas a la API de creación, o edición profunda; esos comportamientos se programarán en la siguiente iteración.

Produce código TSX limpio, modular, tipado con TypeScript y listo para producción.