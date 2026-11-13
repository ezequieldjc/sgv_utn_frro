# Yacanvet — Sistema de Gestión Veterinaria (SGV)

Proyecto final de la UTN FRRO: sistema web de gestión para la clínica veterinaria Yacanvet
(historia clínica, turnos/agenda, stock y ventas, clientes y mascotas, RBAC; más adelante
dictado por voz con NLP y asistencia diagnóstica). La visión completa está en
`docs/contexto.md`.

> Estas instrucciones son el espejo para GitHub Copilot de `.cursor/rules/*.mdc`, que sigue
> siendo la fuente de verdad del equipo. Si cambia una regla de Cursor, actualizá también su
> espejo en `.github/instructions/`.

## Idioma y estilo de respuesta

- Respondé y explicá siempre en español. Las explicaciones van fuera de los bloques de código.
- Código limpio y listo para producción, sin texto conversacional dentro del código.
- Identificadores en el español de dominio que ya usa el repo (`mascota`, `turno`,
  `cliente_service`, `ver_listado`). No traduzcas nombres existentes al inglés.

## Stack

- Backend: Python + FastAPI + SQLModel/Pydantic sobre PostgreSQL multi-schema
  (`core`, `catalogo`, `clinica`, `auth`, `sys`, `agenda`, `stock`, `comercial`). JWT en cookie
  HttpOnly.
- Frontend: SPA con React 18 + TypeScript + Vite + React Router Dom + Tailwind + Shadcn UI +
  `lucide-react`. **No es Next.js**: nada de Server Components, `'use client'`, `app/` router,
  `next/image`, `next/link` ni `next-themes`.
- Tests: Pytest + `TestClient` (backend), Vitest + Testing Library (frontend).

## Estructura y patrón de capas

- `backend/app/api/<modulo>.py`: routers. Cada endpoint recibe `access_token` por
  `Cookie`, llama a `require_permission(session, access_token, "<recurso>:<accion>")` y delega
  en el service. Referencia canónica: `backend/app/api/clientes.py`.
- `backend/app/services/<modulo>_service.py`: lógica de negocio y acceso a datos (solo DML).
- `backend/app/models/<schema>/<tabla>.py`: modelos SQLModel, uno por tabla, con
  `__table_args__ = {"schema": "<schema>"}`.
- `backend/app/schemas/<modulo>.py`: contratos Pydantic de entrada/salida de la API.
- `backend/app/core/`: `errors.py` (`APIError`), `settings.py`, utilidades.
- `backend/tests/test_<modulo>.py`: tests; fixtures en `conftest.py`.
- `frontend/src/pages/<modulo>/`: pantallas (`*-page.tsx`, `*-form-page.tsx`) con sus tests
  `*.test.tsx`. `frontend/src/components/ui/`: Shadcn. `frontend/src/lib/api.ts`: cliente HTTP.
  `frontend/src/types/`: tipos de la API.
- `docs/modelo_datos_v1.md`: diccionario de datos canónico. `docs/prompts botones/`: specs de
  pantalla/feature. `scripts/`: SQL que aplica el DBA (seeds, permisos, DDL manual).

Antes de crear algo nuevo, buscá el módulo hermano más parecido y copiá su estructura.

## Reglas no negociables (detalle en `.github/instructions/`)

1. **DBA-First**: PostgreSQL es la fuente de verdad. La app se conecta como `fastapi_app`,
   que solo tiene DML. Nunca escribas ni ejecutes DDL desde la app, nunca uses
   `metadata.create_all()` fuera de los tests y nunca corras `alembic upgrade` contra la DB de
   la app. Si falta una tabla o columna, **frená** y redactá el pedido al DBA.
2. **No inventes campos**: todo campo tiene que existir en `docs/modelo_datos_v1.md`.
3. **Tipado estricto**: nunca `any` en TypeScript; type hints en todo Python; nunca aceptes ni
   devuelvas `dict` crudos en la API, siempre schemas Pydantic/SQLModel.
4. **RBAC por permiso, nunca por nombre de rol**: códigos `recurso:accion` en español
   (`mascotas:ver_listado`, `roles:editar`), comodín `*`. El backend siempre valida; ocultar en
   la UI es solo UX.
5. **Errores**: `app.core.errors.APIError` con código `SCREAMING_SNAKE` estable y `detalle`
   en español. No inventes formatos de error.
6. **Configuración de negocio** en `sys.config` vía `services/config_service.py`; después de
   cualquier UPDATE, `clear_config_cache()`. `.env` es solo para secretos de infraestructura.
7. **Tests obligatorios**: todo cambio de funcionalidad viene con sus tests. Código sin tests
   está incompleto.

## Secretos

Nunca leas, copies ni pegues en código, tests o respuestas el contenido de `.env`,
`scripts/secretkey.txt` o `cookies.txt`. Los secretos se leen con `get_settings()`
(`backend/app/core/settings.py`). En tests usá valores falsos como hace `conftest.py`.

## Comandos

- Backend (Windows): `cd backend` → `python -m venv .venv` → `.venv\Scripts\activate` →
  `pip install -r requirements.txt` → `uvicorn app.main:app --reload` (http://localhost:8000,
  Swagger en `/docs`).
- Tests backend (lo mismo que corre el CI): `cd backend && python -m pytest`.
- Frontend: `cd frontend` → `npm install` → `npm run dev` (http://localhost:5173).
- Tests frontend: `cd frontend && npm test`.

## Flujo de Git

Ramas `feature/<nombre>` creadas desde `staging`. PR a `staging` (el CI corre `pytest` del
backend y tiene que estar en verde). El release es un único PR `staging` → `main`; `main`
despliega a producción en Vercel. Nunca commitees directo a `main` ni a `staging`.
Detalle en `como mergear.md`.

## Specs

Cuando te pidan implementar una feature, buscá primero su spec en `docs/prompts botones/`.
La spec define objetivo, permisos, contrato de API y reglas de negocio; los patrones
transversales (UI, RBAC, DBA, tipado) salen de estas instrucciones y no se repiten en la spec.
