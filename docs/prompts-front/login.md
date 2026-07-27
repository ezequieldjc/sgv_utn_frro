Create a Login page component for the React + Vite SPA in `src/pages/LoginPage.tsx` using React, Tailwind CSS, Lucide icons, and Shadcn UI components.

### Requirements:
1. **Shadcn UI Imports**: Use `@/components/ui/card`, `@/components/ui/input`, `@/components/ui/button`, `@/components/ui/label`.
2. **Lucide Icons**: Use `User`, `Lock`, and `PawPrint` from `lucide-react`.
3. **Theme Consistency**: Use standard Shadcn CSS variables (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`).

### Layout & Background:
- Full screen wrapper (`h-screen w-full relative flex items-center justify-center overflow-hidden`).
- Background layer: local image path `/bg-login.jpg` with `bg-cover bg-center`.
- Overlay layer: dark translucent backdrop (`bg-slate-950/65`).
- Glassmorphism Card: `relative z-10 w-full max-w-md mx-4 p-6 border-border/40 bg-background/80 shadow-2xl backdrop-blur-md rounded-xl`.

### Component Structure:
- **CardHeader**:
  - Centered `PawPrint` icon inside a circular container (`p-3 rounded-full bg-primary/10 text-primary`).
  - Title: "Ingreso" (`text-2xl font-bold tracking-tight text-center mt-2`).
  - Subtitle: "Sistema de Gestión Veterinario" (`text-xs text-muted-foreground text-center`).
- **CardContent (Form)**:
  - **Usuario Field**: `<Label htmlFor="username">Usuario</Label>`, relative wrapper with `<User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />` and `<Input id="username" placeholder="ej. jperez" className="pl-9" />`.
  - **Contraseña Field**: `<Label htmlFor="password">Contraseña</Label>`, relative wrapper with `<Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />` and `<Input id="password" type="password" placeholder="••••••••" className="pl-9" />`.
  - **Error Message**: render only one error at a time, in red, centered below the fields. Map backend `CREDENCIALES_INVALIDAS` to `Credenciales incorrectas` and backend `USUARIO_DESHABILITADO` to `Usuario deshabilitado`.
  - **Behavior on Error**: when an error is shown, clear both the username and password inputs.
  - **Recover Link**: do not render any "Olvidé mi contraseña" link or password recovery action.
  - **Submit Button**: `<Button type="submit" className="w-full mt-2">Ingresar</Button>`.

### Behavior:
- On successful login, redirect directly to the authenticated shell with sidebar + topbar and an empty main area.
- Do not include any password-change flow in this prompt.
- Produce clean, production-ready TSX code. Do not write explanation prose.
