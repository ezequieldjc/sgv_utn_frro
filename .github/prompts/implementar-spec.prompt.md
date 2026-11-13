---
description: "Implementa una feature completa (backend, frontend y tests) a partir de una spec de docs/prompts botones/."
agent: agent
argument-hint: "Nombre del archivo de spec, ej. clientes_crear.md"
---

Implementá la feature descrita en la spec `docs/prompts botones/${input:spec:archivo de la spec, ej. clientes_crear.md}`.

Seguí este orden y no te saltees pasos:

1. Leé la spec completa y `docs/modelo_datos_v1.md`. Listá las tablas y columnas que usa la
   feature y verificá que existan en el diccionario. Si falta alguna, **frená acá**: no
   escribas código, redactá el pedido al DBA (nombre, tipo, nullability, FKs, para qué sirve)
   y esperá confirmación.
2. Buscá el módulo hermano más parecido en `backend/app/api/`, `backend/app/services/` y
   `frontend/src/pages/` y usalo como plantilla de estructura.
3. Backend: modelos SQLModel (si hacen falta y ya existen en Postgres), schemas Pydantic,
   service con la lógica y router con `require_permission` antes de cualquier lógica. Errores
   con `APIError`.
4. Tests backend en `backend/tests/test_<modulo>.py`: caminos exitosos, errores controlados
   y `403` sin permiso. Corré `cd backend && python -m pytest` y corregí hasta que pase.
5. Frontend: tipos en `frontend/src/types/` (con el TODO de OpenAPI), página o form copiando
   el patrón de referencia, ruta en el router y visibilidad por permisos. Test de la página
   con Vitest. Corré `cd frontend && npm test`.
6. Si se agregan permisos nuevos, proponé el `INSERT` para `scripts/rol_permiso.sql` y
   avisá que lo tiene que aplicar el DBA.
7. Al final, resumí en español: archivos tocados, decisiones que tomaste por tu cuenta y lo
   que queda pendiente del DBA.
