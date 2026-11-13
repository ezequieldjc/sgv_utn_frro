-- Propuesta para revisión del DBA, no ejecutar desde la app.
--
-- Usuario de SOLO LECTURA para que los asistentes de IA (servidor MCP de Postgres en
-- VS Code / Copilot o Claude Code) puedan consultar la estructura real de la base y
-- verificar que una tabla o columna existe antes de usarla (flujo DBA-first).
--
-- Cómo aplicarlo en Neon: desde DBeaver (o el SQL Editor de Neon), conectado con el rol
-- dueño de la base (el que creó los schemas, normalmente neondb_owner).
-- Neon exige contraseña para todo rol creado por SQL: usá una larga y aleatoria,
-- y no la commitees.
-- Si la base tiene datos reales de clientes, aplicalo en una branch de desarrollo de Neon.

CREATE ROLE mcp_readonly WITH LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

-- Toda sesión de este usuario arranca en modo solo lectura y con tiempo máximo por consulta.
ALTER ROLE mcp_readonly SET default_transaction_read_only = on;
ALTER ROLE mcp_readonly SET statement_timeout = '15s';

-- En Postgres el acceso se da a nivel base, schema y objeto.
-- Reemplazá neondb si la base tiene otro nombre.
GRANT CONNECT ON DATABASE neondb TO mcp_readonly;

GRANT USAGE ON SCHEMA core, catalogo, clinica, auth, sys, agenda, stock, comercial
  TO mcp_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA core, catalogo, clinica, auth, sys, agenda, stock, comercial
  TO mcp_readonly;

-- Las tablas que el DBA cree más adelante también quedan legibles.
-- Ejecutar con el mismo rol que crea las tablas (el dueño de los schemas).
ALTER DEFAULT PRIVILEGES IN SCHEMA core, catalogo, clinica, auth, sys, agenda, stock, comercial
  GRANT SELECT ON TABLES TO mcp_readonly;

-- Nunca exponer hashes de contraseñas ni la auditoría de login a la IA.
REVOKE SELECT ON auth.historial_contrasena FROM mcp_readonly;
REVOKE SELECT ON auth.login FROM mcp_readonly;

-- Verificación, conectado como mcp_readonly:
--   SHOW default_transaction_read_only;                                          -- on
--   SELECT has_table_privilege('auth.historial_contrasena', 'SELECT');           -- false
--   SELECT has_table_privilege('clinica.mascota', 'INSERT');                     -- false
--   SELECT count(*) FROM clinica.mascota;                                        -- funciona
