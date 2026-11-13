---
applyTo: "backend/**/*.py,frontend/src/**/*.ts,frontend/src/**/*.tsx"
description: "Reglas obligatorias de testing (Pytest y Vitest): qué testear, qué mockear, nombres y compatibilidad con el CI. Espejo de la sección de testing de .cursor/rules/tech-stack.mdc."
---

# Testing y control de calidad

## Siempre con tests

Al escribir o modificar una funcionalidad generá **siempre** sus tests en el mismo cambio.
Código sin tests está incompleto. Después de generarlos, corrélos (`cd backend && python -m
pytest`, `cd frontend && npm test`) y corregí hasta que pasen.

## Tests autodocumentados

- Nunca generes archivos aparte (`TESTS.md`, planillas) para listar tests.
- Nombres con el patrón `test_<feature>_<condicion>_<resultado_esperado>`
  (ej. `test_crear_turno_fecha_pasada_devuelve_error_400`).
- Docstrings en Python solo para explicar reglas de negocio complejas.

## Qué hay que testear

1. Reglas de negocio y lógica crítica: inventario unificado (Pet Shop + Farmacia), descuento de
   stock, cálculo de agenda y alertas.
2. Autorización (RBAC): un usuario sin el permiso requerido (ej. `mascotas:crear`,
   `roles:editar`) recibe `403`.
3. Endpoints: respuestas exitosas (`200`/`201`) y errores controlados (`400`, `403`, `404`, `500`).
4. Integración con BD: persistencia real de entidades (historias clínicas, mascotas, turnos).
5. Efectos de sesión/config: bump de `version_token` al cambiar permisos de un rol;
   `clear_config_cache()` después de editar `sys.config`.

## Qué no hay que testear

1. APIs externas (modelos de IA, WhatsApp, transcripción): **nunca** llamadas HTTP reales.
   Siempre mocks/patches de las respuestas.
2. Librerías de terceros (FastAPI, SQLModel, React).
3. Estilos y píxeles (clases de Tailwind, márgenes, colores).

## Niveles y stack

- Unitarios: Pytest (backend) y Vitest + Testing Library (frontend), para funciones puras,
  validaciones de Pydantic y render aislado. Los tests de pantalla viven junto a la página
  (`frontend/src/pages/<modulo>/<pagina>.test.tsx`).
- Integración: Pytest + `TestClient` de FastAPI. Hoy `backend/tests/conftest.py` usa SQLite en
  memoria con `schema_translate_map` (así el CI es determinista sin Postgres). Reutilizá sus
  fixtures (`engine`, `session`, `client`) y los helpers de los `test_<modulo>.py` vecinos en
  vez de crear otros.
- E2E (Playwright o Cypress) solo para caminos críticos: login, historia clínica por dictado
  de voz y venta/cierre en Pet Shop.

## CI

Todo test tiene que ser automatizado, determinista y correr con `pytest` en GitHub Actions
(`.github/workflows/ci.yml`, se dispara en los PR a `staging` y `main`).
