---
description: "Arma el pedido al DBA (y un script SQL propuesto) cuando una feature necesita tablas, columnas, permisos o filas de sys.config que todavía no existen."
agent: agent
argument-hint: "Qué feature necesita la estructura nueva"
---

Necesito pedirle al DBA la estructura para: ${input:feature:feature o necesidad}.

1. Revisá `docs/modelo_datos_v1.md` y los scripts de `scripts/` para confirmar qué ya existe
   y no pedir nada duplicado.
2. Redactá el pedido en español, en una tabla por objeto: schema, tabla, columna, tipo,
   nullability, default, FK y para qué sirve. Respetá snake_case en singular y el schema que
   corresponda (`core`, `catalogo`, `clinica`, `auth`, `sys`, `agenda`, `stock`, `comercial`).
   Para datos variables de historia clínica proponé JSONB, no columnas sueltas.
3. Escribí un script SQL propuesto en `scripts/<modulo>/NNN_<descripcion>.sql` con el DDL,
   los `GRANT` de DML para `fastapi_app` y los `INSERT` de permisos o de `sys.config` que hagan
   falta. Encabezalo con un comentario: "Propuesta para revisión del DBA, no ejecutar desde
   la app".
4. Agregá al diccionario `docs/modelo_datos_v1.md` las tablas/columnas nuevas marcadas como
   "pendiente de DBA".
5. No toques modelos SQLModel, schemas ni endpoints hasta que el DBA confirme que la
   estructura existe en Postgres.
