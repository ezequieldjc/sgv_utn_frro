---
description: "Redacta una spec nueva en docs/prompts botones/ con el mismo formato que las existentes, sin escribir código."
agent: agent
argument-hint: "Descripción breve de la feature"
---

Redactá una spec nueva para esta feature: ${input:feature:descripción de la feature}.

No escribas código de la aplicación; el único archivo que creás es la spec.

1. Leé `docs/prompts botones/clientes_crear.md` y `docs/prompts botones/mascotas_listado.md`
   como modelo de formato y nivel de detalle.
2. Leé `docs/modelo_datos_v1.md` y usá solo tablas y columnas que existan. Si la feature
   necesita estructura nueva, agregá una sección "Prerrequisitos DBA" con lo que hay que
   pedir, en vez de inventar campos.
3. Revisá `scripts/rol_permiso.sql` para reutilizar códigos de permiso existentes; si hacen
   falta nuevos, proponelos con el formato `recurso:accion` en español.
4. Incluí: objetivo, tabla de permisos, ruta y estructura del frontend, contrato de API
   (request/response en JSON y tabla de errores con códigos `SCREAMING_SNAKE`), reglas de
   backend numeradas, modales o estados de UI y la lista de tests esperados.
5. No repitas en la spec reglas transversales (layout, AccessDenied, validación manual,
   RBAC, DBA-first, tipado): esas ya están en las instrucciones del repo.
6. Guardala como `docs/prompts botones/<modulo>_<accion>.md` y marcá al final las dudas
   abiertas que el equipo tenga que decidir.
