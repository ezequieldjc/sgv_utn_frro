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

## Agentes del proyecto

En `.github/agents/` hay tres agentes que aparecen en el selector de agentes del chat, al lado
de Ask, Plan y Agent. Cada uno tiene su rol, sus herramientas y sus límites ya escritos, así
que no hace falta explicarle todo cada vez.

El agente **DBA** se usa cuando una feature necesita estructura nueva: diseña las tablas,
escribe el script SQL propuesto en `scripts/` y marca lo pendiente en el diccionario, pero no
puede tocar `backend/` ni `frontend/`. Cuando el DBA confirma que la estructura ya existe,
el botón "Implementar con la estructura confirmada" pasa la conversación al agente normal para
que programe. El agente **Revisor** no edita nada: lee los cambios de la rama, los compara
con las reglas y corre los tests. Conviene usarlo siempre antes de abrir un PR. El agente
**Dictado NLP** es el del módulo de dictado por voz: conoce el flujo Whisper.cpp → Claude →
ficha, las reglas de mockear los servicios externos y la skill de la ficha clínica, y al
terminar ofrece pasarle el trabajo al Revisor.

## Skill de la ficha clínica

En `.github/skills/extraccion-ficha-clinica/` está la parte del NLP del diseño acordado en
`docs/flujo_de_los_datos.md`: qué trae la ficha del contrato 1.0 y a qué tabla y columna va
cada parte, los principios del prompt de extracción y siete casos de ejemplo para los tests
(signos negados, signos sin código, valores fuera de rango, falla de Claude, falla de Whisper
y un dictado que no pisa lo confirmado). Copilot la carga solo cuando la tarea tiene que ver
con el dictado, así que no ocupa contexto en el resto del proyecto. Las claves exactas del
JSON todavía son provisorias: las definitivas son las del contrato 1.0 del prototipo del NLP.

## Herramientas externas (MCP)

Cada uno configura en su máquina, en `.vscode/mcp.json` (no se versiona), los servidores MCP
que quiera usar. Recomendamos dos. **Context7** le da a Copilot la documentación actualizada
de FastAPI, SQLModel, Shadcn y el resto del stack, y no necesita configuración. El servidor
de **Postgres** le permite consultar la estructura real de la base. Va siempre con el usuario
`mcp_readonly` (script en `scripts/mcp/001_usuario_mcp_readonly.sql`, que aplica el DBA en
las bases de desarrollo) y en modo restringido, así no puede escribir nada ni leer los hashes
de contraseñas. Para usarlo hace falta tener instalado `uv` (en Windows,
`winget install astral-sh.uv`).

Las extensiones recomendadas del proyecto están en `.vscode/extensions.json`. VS Code las
ofrece instalar la primera vez que abrís la carpeta.

## Cloud agent

El archivo `.github/workflows/copilot-setup-steps.yml` le deja preinstaladas al cloud agent
las dependencias del backend y del frontend, para que pueda correr los tests desde el primer
minuto. GitHub solo lo tiene en cuenta cuando está en `main`, así que empieza a funcionar
después del próximo release de `staging` a `main`. Al asignarle una tarea, siempre hay que
pedirle que abra el PR contra `staging`.

## Flujo de trabajo, de punta a punta

Toda pieza nueva sigue el mismo recorrido: una pantalla, un endpoint o un lote de tablas de la
historia clínica. Conviene que las piezas sean chicas, porque un PR que toca demasiadas cosas
nadie lo revisa bien.

**1. Arrancar la rama.** Siempre desde `staging` actualizada: `git switch staging`,
`git pull origin staging` y `git switch -c feature/<nombre>`.

**2. Si hace falta estructura nueva, primero va la base.** Elegí el agente **DBA** y contale
qué necesitás, o pasale la sección de `docs/flujo_de_los_datos.md` que corresponde. Revisa
qué hay en Neon a través del MCP y escribe el script en `scripts/<modulo>/`. Lo revisás vos,
lo aplica **una sola persona** en DBeaver (así nadie pisa a nadie) y, recién cuando la tabla
existe, el botón "Implementar con la estructura confirmada" pasa la conversación al agente
que programa. El script viaja en el mismo PR, para que el resto vea qué cambió en la base.
Las tablas de la historia clínica se suman así, de a un lote por vez.

**3. Escribir la spec.** Si la pieza tiene pantalla o API, `/nueva-spec` arma la spec en
`docs/prompts botones/`. Si toca algo que también usa otro compañero (por ejemplo
`clinica.consulta`, que comparten el NLP, el motor y la historia clínica), revisala con él
antes de programar.

**4. Planificar y programar.** Abrí un chat nuevo para la tarea. Empezá en modo **Plan**,
corregí el plan y después pasá a **Agent** con `/implementar-spec`, o usá directamente el
agente **Dictado NLP** si es tu módulo. Dale contexto con `#file:` (la spec y el módulo
hermano que tiene que copiar) y leé el diff antes de aceptar cada cambio.

**5. Probar.** Los tests (`python -m pytest` y `npm test`) los corre el agente solo, sin
pedirte permiso. Además, levantá el backend y el frontend (ver `como correr.md`) y probá la
pantalla a mano, como la va a usar el veterinario.

**6. Revisar.** Antes del PR, elegí el agente **Revisor**: compara la rama con las reglas,
corre los tests y te devuelve los problemas ordenados por gravedad.

**7. PR a `staging`.** Commit, push y PR con base `staging`. El CI corre los tests, un
compañero lo mira y se mergea. El paso de `staging` a `main` se hace entre todos, como dice
`como mergear.md`.

**8. Tareas chicas al cloud agent.** Una vez que `copilot-setup-steps.yml` esté en `main`,
las tareas acotadas (un filtro, un test que falta, un texto) se pueden cargar como issue y
asignárselas a Copilot. Su PR se revisa igual que el de un compañero.

**9. Cuando Copilot se equivoca dos veces en lo mismo**, agregá una línea en la instrucción
que corresponda de `.github/instructions/`. Si la regla nace en `.cursor/rules/`, actualizá
los dos archivos.

## Cómo trabajamos los tres a la vez

El NLP, el motor de diagnóstico y la historia clínica se hablan a través de dos funciones:
`procesar_dictado(tramos)`, que devuelve la ficha del contrato 1.0, y
`diagnosticar(reseña, signos)`, que devuelve el top 3 con códigos de patología. Si primero
acordamos esas dos firmas y cada una arranca con una versión de mentira (un *stub* que
devuelve siempre la misma ficha o el mismo top 3), cada uno puede avanzar sin esperar al otro.
La pantalla de la consulta y la firma se pueden armar con los stubs, y cuando el NLP o el
motor real están listos, se reemplaza el stub sin tocar nada más. Los stubs sirven además
como mocks en los tests.

## Lo que Copilot no tiene que hacer nunca

Copilot no debe crear tablas, correr migraciones contra la base ni inventar campos. Si te
dice que hace falta una columna nueva, el camino es `/pedido-dba` y esperar a que el DBA la
cree. Tampoco tiene que leer ni copiar `.env`, `scripts/secretkey.txt` o `cookies.txt`. Las
instrucciones se lo prohíben, pero si alguna vez propone un cambio con un secreto adentro,
descartalo.
