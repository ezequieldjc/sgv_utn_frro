# Cómo correr el proyecto

## Primera vez (instalación)

### Backend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/frontend
npm install
npm run dev
```

---

## Después

### Backend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/frontend
npm run dev
```

---

## Para ver la app

- Frontend: http://localhost:5173
- Backend: http://localhost:8000

---

# En Windows (PowerShell), contra la base de Neon

Lo de arriba son los pasos en Mac. Acá están los de Windows, con la base compartida en Neon.

## Lo que tiene que estar instalado

Python 3.10 o superior (el CI usa 3.10 y el código usa la sintaxis `str | None`, que no
existe antes), Node 20 y Git. Si tenés Anaconda, ojo: conda suele ponerse primero en el
PATH y el `python` que se ejecuta termina siendo el de conda. Para evitarlo, creá el entorno
con el lanzador de Windows (`py`) o corré `conda deactivate` antes.

## Backend, la primera vez

```powershell
cd C:\Users\Bruno\Desktop\sgv_utn_frro\backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Si PowerShell no te deja activar el entorno ("la ejecución de scripts está deshabilitada"),
corré una sola vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y volvé a probar.

Después abrí `backend\.env` y completalo así:

```text
DATABASE_URL=postgresql+psycopg2://fastapi_app:CLAVE@HOST/neondb?sslmode=require
SECRET_KEY=una-clave-larga-y-aleatoria
```

La app se conecta siempre con el usuario `fastapi_app`, que solo puede leer y escribir datos,
nunca cambiar la estructura (ver `permisos_sql.md`); la clave se la pedís al equipo, nunca
por un canal público. El `HOST` es el mismo que usás en DBeaver (o el que muestra la consola
de Neon en "Connection string"), y el `?sslmode=require` del final es obligatorio en Neon.
Para `SECRET_KEY` generá una propia con
`python -c "import secrets; print(secrets.token_urlsafe(48))"`: solo firma las sesiones de
tu backend local. El `.env` está en el `.gitignore` y no se commitea nunca.

**No corras `scripts/seed_admin.py` contra Neon.** Ese script intenta crear tablas
(`create_all`), cosa que va contra el flujo DBA-first, y el usuario administrador ya existe.

Para levantarlo:

```powershell
uvicorn app.main:app --reload
```

La API queda en http://localhost:8000 y la documentación interactiva en
http://localhost:8000/docs. `--reload` reinicia el servidor solo cada vez que guardás un
archivo.

## Backend, las veces siguientes

```powershell
cd C:\Users\Bruno\Desktop\sgv_utn_frro\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

## Frontend

En otra terminal (en VS Code podés dividir la terminal y tener las dos a la vista):

```powershell
cd C:\Users\Bruno\Desktop\sgv_utn_frro\frontend
npm install
npm run dev
```

`npm install` solo hace falta la primera vez o cuando cambia `package.json`. La app queda en
http://localhost:5173. No hay que configurar la URL del backend: Vite redirige todo lo que
empieza con `/api` a http://127.0.0.1:8000 (está en `vite.config.ts`), y el backend ya acepta
pedidos desde localhost:5173.

## Tests

- Backend: `cd backend` y `python -m pytest`, con el entorno activado. Usa una SQLite en
  memoria, así que no toca Neon y podés correrlo todas las veces que quieras.
- Frontend: `cd frontend` y `npm test`.

Son los mismos que corre el CI en cada PR a `staging`. Si pasan en tu máquina, casi seguro
pasan en GitHub.

## Una advertencia sobre Neon

Tu backend local escribe en la misma base que usan tus compañeros: un turno o una consulta que
cargues para probar lo ven todos. Para pruebas que escriben mucho, como el dictado, conviene
crear en Neon una branch de la base para vos: es una copia que se hace en segundos y se borra
cuando terminás. Solo cambia el `HOST` del `.env`.

## Si algo falla

- **No conecta o da un error de SSL:** falta el `?sslmode=require` o el host está mal copiado.
- **`permission denied for table ...`:** la tabla existe, pero `fastapi_app` no tiene permisos
  sobre su schema. Hay que darle los `GRANT` como en `permisos_sql.md` o
  `scripts/base/catalogo_grant_fastapi_app.sql`.
- **`relation ... does not exist`:** el código usa una tabla que todavía no está en Neon. Por
  DBA-first, primero se crea en la base y después se programa.
- **El primer pedido tarda varios segundos:** en el plan gratuito, Neon suspende la base
  cuando no se usa y tarda un poco en despertarla. Es normal.
