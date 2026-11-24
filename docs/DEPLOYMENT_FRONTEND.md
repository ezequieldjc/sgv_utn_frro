# Despliegue del frontend

El frontend **no tiene un servicio propio**: se compila y se sirve desde el mismo App Service
del backend (`sgv-api`). Una sola URL para todo:

- App: `https://sgv-api-g7fkd4bhcag3bsa3.brazilsouth-01.azurewebsites.net/`
- API: la misma URL + `/api/...`
- Swagger: la misma URL + `/docs`

## Por qué así

El login usa cookies HttpOnly con `SameSite=Strict`. Si el frontend estuviera en otro dominio
(por ejemplo Azure Static Web Apps, `*.azurestaticapps.net`), el navegador no mandaría esas
cookies a la API. Con `SameSite=None` andaría en Chrome y Edge, pero no en Safari, en el iPhone
ni en modo incógnito. Con todo en el mismo dominio no hace falta CORS y funciona en todos los
navegadores.

## Cómo funciona

1. El workflow `.github/workflows/main_sgv-api.yml` (se dispara con cada push a `main`):
   - instala Node 20 y corre `npm ci` + `npm run build` en `frontend/`, con
     `VITE_API_BASE_URL` vacía para que el frontend llame a `/api` en su mismo dominio;
   - copia `frontend/dist` a `backend/static`;
   - despliega `backend/` (con `static/` adentro) a `sgv-api`, igual que antes.
2. `backend/app/core/frontend.py` sirve esos archivos:
   - `/assets/*` y los archivos de `frontend/public` (`/icon.png`, etc.) tal cual;
   - cualquier otra ruta (`/agenda`, `/consultas/7`, ...) devuelve `index.html` y la resuelve
     React Router;
   - `/api/*`, `/docs`, `/redoc` y `/openapi.json` siguen siendo del backend (una ruta `/api`
     que no existe da 404 en JSON, no la pantalla del frontend).
3. En desarrollo `backend/static` no existe, así que no se registra nada y se sigue trabajando
   como siempre (`npm run dev` en el puerto 5173 + `uvicorn` en el 8000).

## Variables de entorno del App Service

| Variable | Valor en producción | Para qué |
|---|---|---|
| `COOKIE_SECURE` | `true` | La cookie de sesión solo viaja por HTTPS. |
| `COOKIE_SAMESITE` | `strict` (o sin definir) | Valor por defecto, no cambiar. |
| `CORS_ORIGINS` | sin definir | Solo hace falta si algún día el frontend vive en otro dominio (lista separada por comas, sin `/` final). |

No hace falta ningún secreto nuevo en GitHub.

## Flujo de cambios

`feature/*` → PR a `staging` → PR de `staging` a `main` → el push a `main` despliega
backend + frontend juntos.

## Checklist después de desplegar

- [ ] El workflow "Build and deploy Python app to Azure Web App - sgv-api" terminó en verde.
- [ ] La URL raíz abre la pantalla de login.
- [ ] Recargar el navegador en una ruta interna (por ejemplo `/agenda`) no da 404.
- [ ] Login correcto; en DevTools → Application → Cookies aparecen `access_token` y
      `refresh_token` con `HttpOnly`, `Secure` y `SameSite=Strict`.
- [ ] En DevTools → Network las llamadas van a `/api/...` del mismo dominio y no hay errores
      de CORS en Console.
- [ ] `/docs` sigue mostrando Swagger.
- [ ] Probado también en Safari o en el celular.

Nota: el plan F1 apaga la app cuando no tiene tráfico. La primera visita después de un rato
puede tardar varios segundos en cargar; no es un error.
