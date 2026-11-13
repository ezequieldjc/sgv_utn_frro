# Cómo usar GitHub Copilot en este proyecto

Este repo ya venía preparado para Cursor con las reglas de `.cursor/rules/`. Copilot no lee
esa carpeta, así que agregamos un espejo de esas reglas en `.github/`. Cursor sigue funcionando
igual que antes: quien use Cursor no tiene que cambiar nada, y quien use Copilot en VS Code
recibe las mismas reglas.

## Qué hay en `.github/` y para qué sirve

El archivo `.github/copilot-instructions.md` es el contexto general que Copilot suma
automáticamente a cada pedido que le hacemos dentro del repo. Resume qué es Yacanvet, el
stack, cómo se reparten las capas (router → service → modelo), las reglas que no se pueden
romper, los comandos para correr y testear, y el flujo de ramas. Gracias a eso no hace falta
explicarle en cada chat que esto es una SPA con Vite y no Next.js, o que la app no puede
crear tablas.

En `.github/instructions/` están las reglas detalladas, una por cada archivo de Cursor. Cada
una tiene un `applyTo` en el encabezado que indica a qué archivos se aplica: las de UI solo
entran en juego cuando Copilot toca archivos `.tsx` del frontend, la de DBA-first cuando
trabaja en el backend, y así. Funciona igual que los `globs` de Cursor: Copilot carga solo
las reglas relevantes y no se satura de contexto.

En `.github/prompts/` hay cuatro prompts reutilizables que se ejecutan escribiendo `/` en el
chat. `/implementar-spec` toma una spec de `docs/prompts botones/` y la implementa de punta a
punta: primero verifica que las tablas existan, después backend, tests, frontend y otra vez
tests. `/nueva-spec` redacta una spec nueva con el mismo formato que las que ya tenemos,
sin escribir código. `/pedido-dba` arma el pedido de estructura al DBA, con un script SQL
propuesto, cuando una feature necesita algo que no existe en la base. `/revisar-cambios`
compara tu rama contra `staging` y te lista lo que rompe las reglas antes de abrir el PR.

## Cuando cambia una regla

La fuente de verdad del equipo sigue siendo `.cursor/rules/`. Si alguien modifica una regla
ahí (por ejemplo, agrega un schema nuevo en `database-types.mdc`), tiene que actualizar
también su espejo en `.github/instructions/`, que tiene el mismo nombre. Si nos olvidamos,
Copilot va a trabajar con la versión vieja de la regla.

## Cómo trabajar con Copilot en el día a día

Los modos del chat de VS Code sirven para cosas distintas. El modo **Ask** es para preguntar
sin que toque nada ("¿cómo se valida un permiso en este backend?"). El modo **Agent** es el
que se parece a Cursor: lee el repo, edita varios archivos, corre `pytest` en la terminal y
se corrige solo si algo falla. Cada cambio queda para que lo aceptes o lo descartes. Para
features completas conviene arrancar con el modo **Plan**, revisar el plan que propone y
recién después pasarlo a Agent.

Las referencias con `#` son la forma de darle contexto preciso. `#file:` le pasa un archivo
concreto, por ejemplo una spec o el módulo que querés que copie como modelo. Pedidos como
"hacé lo mismo que #file:backend/app/api/clientes.py pero para X" funcionan mucho mejor que
una descripción genérica, porque Copilot copia los patrones reales del proyecto en lugar de
inventar los suyos.

En el plan Student no se elige el modelo: Copilot lo selecciona automáticamente. Los pedidos
consumen créditos de IA según el tamaño, y el modo Agent con mucho contexto es lo que más
gasta, así que conviene acotar los pedidos (una feature por vez, con la spec y el módulo de
referencia) en lugar de pedirle "todo el módulo de stock" de una.

También existe el **cloud agent** en github.com: se le asigna un issue a Copilot y trabaja
en la nube hasta abrir un PR. Como el CI corre `pytest` en cada PR a `staging`, ese PR pasa
por los mismos tests que cualquier otro. Hay que pedirle que abra el PR contra `staging` y
no contra `main`, porque `main` despliega a producción.

## Lo que Copilot no tiene que hacer nunca

Copilot no debe crear tablas, correr migraciones contra la base ni inventar campos. Si te
dice que hace falta una columna nueva, el camino es `/pedido-dba` y esperar a que el DBA la
cree. Tampoco tiene que leer ni copiar `.env`, `scripts/secretkey.txt` o `cookies.txt`. Las
instrucciones se lo prohíben, pero si alguna vez propone un cambio con un secreto adentro,
descartalo.
