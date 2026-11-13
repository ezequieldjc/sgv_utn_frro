---
description: "Revisa los cambios de la rama actual contra las reglas del repo antes de abrir el PR a staging."
agent: agent
---

Revisá los cambios de la rama actual respecto de `staging` (usá `git diff staging...HEAD`)
antes de que abra el PR.

Chequeá, archivo por archivo, contra las instrucciones del repo:

1. DBA-first: nada de DDL, `create_all()` fuera de tests ni `alembic upgrade`; ningún campo
   que no esté en `docs/modelo_datos_v1.md`.
2. Seguridad: todo endpoint nuevo llama a `require_permission` antes de la lógica; no se
   compara el nombre de un rol; no hay secretos ni credenciales en código, tests o docs.
3. Tipado: sin `any` en TypeScript, type hints en Python y sin `dict` crudos en la API.
4. Errores con `APIError` y códigos estables.
5. UI: Shadcn, sin toasts, sin React Hook Form/Zod, AccessDenied y banners según el patrón.
6. Tests: cada cambio de funcionalidad tiene tests, incluido el `403` sin permiso. Corré
   `cd backend && python -m pytest` y `cd frontend && npm test` y reportá el resultado.

Devolvé una lista de hallazgos ordenada de más grave a menos grave, cada uno con archivo,
línea y la corrección sugerida. No apliques cambios hasta que te lo pida.
