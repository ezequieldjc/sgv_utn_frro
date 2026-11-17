---
applyTo: "frontend/src/**/*.tsx"
description: "UI con Shadcn + Tailwind, paleta Slate/Emerald, layouts y patrones UX de forms, listados, AccessDenied y RBAC en pantalla. Espejo de .cursor/rules/ui-layout.mdc."
---

# UI, layout y patrones UX

## Base

- Shadcn UI (`@/components/ui/...`) siempre que exista el componente; nada de inputs,
  botones, modales o selects en HTML crudo.
- Íconos de `lucide-react`. `PawPrint` es el fallback/branding del proyecto.
- Tailwind con las variables de Shadcn (`bg-background`, `text-foreground`, `border-border`,
  `bg-primary`, `text-muted-foreground`). Nunca colores hex hardcodeados.
- Imports con alias: `@/components/...`, `@/lib/...`, `@/types/...`, `@/hooks/...`.
- Paleta: **Slate** para neutros/fondos/bordes/textos secundarios y **Emerald** para acciones
  primarias, sidebar activo y acentos. Contenedores `rounded-2xl` con `shadow-sm`/`shadow-md`.
- Dark/Light: Context propio (`ThemeProvider`) que guarda la preferencia en `localStorage` y
  togglea la clase `dark` en la raíz. **No** `next-themes`.

## Layouts

- Login: viewport completa, fondo `/login_background.jpg` (`bg-cover bg-center`) con overlay
  oscuro y tarjeta central glassmorphism (`backdrop-blur-md` + `bg-card/80`), bordes sutiles y
  `shadow-2xl`. Logo `/logo.png` con fallback `PawPrint`.
- Shell autenticado: sidebar fijo a la izquierda, topbar arriba y área de contenido. Los
  ítems del sidebar dependen de permisos, nunca de nombres de rol.

## Referencias canónicas (copiá estructura, no reinventes)

- Forms: `pages/mascotas/mascota-form-page.tsx`, `pages/clientes/cliente-form-page.tsx`,
  `pages/admin/usuario-form-page.tsx`.
- Listados y hubs Admin: `pages/admin/catalogos-page.tsx`, `pages/admin/roles-page.tsx`,
  `pages/admin/parametros-page.tsx`, `pages/admin/usuarios-page.tsx`,
  `pages/mascotas/mascotas-page.tsx`.

## Forms: prohibido y permitido

- **No** React Hook Form, Zod ni librerías de toast (sonner, react-hot-toast…).
- Validación manual en el módulo (helpers exportados + `FormErrors`).
- Acciones sensibles se confirman con `Dialog` de Shadcn, nunca `window.confirm`.
- Feedback de página con banners inline (`rounded-2xl border … px-4 py-3 text-sm`): verde
  para éxito, destructive para error. Sin toasts.

## AccessDenied

Sin el permiso de *ver* de la pantalla (ni `*`): early return con bloque centrado, ícono
`ShieldOff` en caja `rounded-2xl bg-muted`, título "Acceso denegado" y mensaje muted propio
del módulo. La misma pieza en listados y forms.

## Header de página

- Listados/hubs: eyebrow opcional (ej. `Admin` + ícono) → `h1` → subtítulo
  `text-sm text-muted-foreground`.
- Forms: volver con `ArrowLeft` + título + subtítulo; CTA de guardar arriba o al pie,
  consistente con el form hermano.

## Forms de alta/edición

- Campos agrupados en `section` con `rounded-2xl border bg-card p-5 shadow-sm` (un bloque
  temático por sección).
- Cada campo: `Label` + control Shadcn (`Input`, `Textarea`, `Checkbox`, select tipado).
- Error de campo: `border-destructive focus-visible:ring-destructive` + mensaje
  `text-sm text-destructive` debajo. Al fallar la validación, foco (y scroll) al primer campo
  con error.
- Botón primario para guardar; `variant="outline"` para cancelar/volver. Durante el submit,
  `Loader2` con `animate-spin` y controles deshabilitados.
- Selects con typeahead: `useSelectTypeahead` / `@/lib/select-typeahead`.

## Listados y hubs Admin

- Barra de controles en una fila (stack en mobile): buscador a la izquierda, filtros, CTA
  primario a la derecha condicionado al permiso.
- Tabla o matriz dentro de `rounded-2xl border bg-card shadow-sm`.
- Estados: `Skeleton` al cargar, texto claro si está vacío, banner destructive recuperable si
  falla el fetch.
- Badges Activo/Inactivo: verde (`bg-green-100 text-green-800` + equivalente dark) / rojo
  (`bg-destructive/10 text-destructive`).
- Hubs con nav lateral (Catálogos, Roles): nav vertical en desktop + `Select` en mobile;
  alineá el tope del nav con la barra de controles.
- Solo lectura: con permiso de ver pero no de editar → inputs `disabled`/`readOnly` y sin
  botón Guardar.

## RBAC en UI

`hasPermission(permisos, required)` = `permisos.includes("*") || permisos.includes(required)`.
Ocultá o deshabilitá CTAs según el permiso de la acción. La seguridad real es del backend.
