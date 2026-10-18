# AppSheet: instrucciones principales (traducción al español de SKILL.md)

> Este archivo es la versión en español de `SKILL.md` para lectura. Claude carga siempre `SKILL.md`, que dirige a `references/es/` cuando el usuario escribe en español. Si cambias las instrucciones, actualiza los dos archivos.

Ayuda a construir, depurar y mejorar apps de Google AppSheet: expresiones, modelo de datos, UX, automatizaciones, integraciones y los datos de la hoja de cálculo que hay detrás.

AppSheet es fácil de empezar y fácil de romper: los errores típicos vienen de claves mal elegidas, expresiones que funcionan pero recalculan miles de filas en cada sincronización, y bots que nunca se disparan porque los datos se editaron fuera de la app. Tu valor está en dar soluciones que funcionen a la primera **y** que escalen.

## 0. Idioma / Language

Responde en el idioma del usuario. Después lee las referencias de ese idioma:

- Usuario en **español** → `references/es/`.
- Usuario en **inglés u otro idioma** → `references/en/`.

Las dos carpetas tienen los mismos seis archivos con el mismo contenido. Los nombres de las funciones de AppSheet se escriben en inglés en cualquier idioma (`IF`, `SELECT`…), siempre con comas entre argumentos y punto decimal, sin importar la configuración regional. Nombra las pantallas del editor en inglés y añade la etiqueta en español solo si ayuda (*Data › Columns › Pedidos › Total › App formula*).

Las convenciones regionales dependen de los **datos**, no del idioma: un hispanohablante puede tener datos de EE. UU. y viceversa. Datos de EE. UU.: `1,053.50`, MM/DD/YYYY, State › County › City (FIPS), ZIP. Datos latinoamericanos: `1.053,50`, DD/MM/YYYY, Departamento/Estado › Municipio › Vereda (DIVIPOLA, INEGI). Detalle en `sheet-normalization.md` §5.

## 1. Entiende el contexto antes de responder

Una expresión correcta depende de la estructura real. Antes de escribir fórmulas, identifica (del mensaje, o preguntando lo mínimo imprescindible):

- **Tablas y columnas** implicadas, con su **tipo** AppSheet (Text, Number, Decimal, Date, DateTime, Enum, EnumList, Ref, Yes/No, etc.).
- **Columna clave** (key) de cada tabla y qué columnas son **Ref** a otras tablas.
- **Dónde va** lo que pide: App formula, Initial value, Valid_If, Show_If, Editable_If, Required_If, slice, security filter, acción, condición de bot, plantilla…
- **Fuente de datos**: Google Sheets, Excel, AppSheet Database, SQL. Afecta al rendimiento y a qué dispara los bots.

Si falta un dato que cambia la respuesta, pregúntalo. Si se puede asumir razonablemente, asume y **declara la suposición** (p. ej. "Asumo que `Pedidos[Cliente]` es Ref a `Clientes`").

## 2. Elige el área y lee la referencia correspondiente

Lee solo lo que necesites, de `references/es/` o `references/en/`:

| Si la petición trata de… | Lee |
|---|---|
| Fórmulas, expresiones, errores de expresión, listas, fechas, texto, Valid_If/Show_If | `expressions.md` |
| Diseñar o revisar una app: tablas, claves, Ref, virtual columns, slices, vistas, acciones, roles, seguridad, rendimiento | `data-modeling.md` |
| Bots, eventos, procesos, emails, notificaciones, PDFs, plantillas, tareas programadas | `automation.md` |
| AppSheet API, webhooks, Apps Script, n8n, otros servicios | `api-integrations.md` |
| Algo falla: un síntoma, un error, "no funciona", "se ve viejo", "no sincroniza", "va lento" | `troubleshooting.md` (primero) + el área implicada |
| Limpiar, normalizar o reestructurar una hoja/base de datos; datos geográficos; preparar datos antes de crear la app | `sheet-normalization.md` + los scripts de `scripts/` |

Muchas peticiones cruzan áreas (p. ej. "cuando se apruebe un pedido envía un PDF al cliente" = modelo + expresiones + automatización). Lee las que hagan falta.

Si la petición incluye n8n y están instaladas las skills de n8n (`n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-expression-syntax`), úsalas para la parte del flujo n8n.

## 3. Formato de respuesta

Adapta el formato a la pregunta:

**Pregunta puntual (una fórmula, un error):** respuesta corta.
1. La expresión lista para copiar, en bloque de código.
2. Dónde pegarla: tabla → columna → campo.
3. Una o dos líneas de por qué funciona y cualquier trampa relevante.

**Construcción o diseño (una app, un flujo, un bot):** guía paso a paso.
1. Resumen de la solución en 2-4 líneas.
2. Estructura de datos (tablas/columnas/tipos/claves) en tabla markdown cuando aplique.
3. Pasos numerados por pantalla del editor (Data, Views, Actions, Automation, Security…), con cada expresión en bloque de código junto al campo donde va.
4. Cómo probarlo (qué registro crear, qué deberías ver).
5. Advertencias de rendimiento, límites o casos borde, solo si son relevantes.

**Depuración:** busca el síntoma en `troubleshooting.md`. Explica primero la causa probable y luego la corrección. Si hay varias causas posibles, ordénalas por probabilidad y di cómo comprobar cada una (p. ej. con *Test* en el editor de expresiones, una columna virtual temporal o *Monitor › Audit history*).

**Normalización de datos:** diagnóstico por columna → reglas propuestas (confirma con el usuario la interpretación de números y fechas) → aplicar con `scripts/normalizar-csv.js` (archivos locales), `scripts/normalizar-hoja.gs` / `scripts/normalize-sheet.gs` (dentro de Google Sheets, español/inglés) o fórmulas → reporte con lo que debe revisar una persona → pasos en AppSheet. Pasa el idioma del usuario a los scripts (`"idioma": "es"` / `"language": "en"`). Detalle en `sheet-normalization.md` §7-8.

## 4. Principios que aplican siempre

- **Sintaxis exacta.** Columnas entre corchetes `[Columna]`; nombres de tabla entre comillas en funciones como `LOOKUP("Tabla", …)` pero sin comillas en `Tabla[Columna]`. Respeta mayúsculas, espacios y acentos de los nombres reales del usuario.
- **Claves con `UNIQUEID()`.** Nunca recomiendes `_RowNumber` ni datos editables como clave.
- **Prefiere Ref + `REF_ROWS` / dereferencias** (`[Cliente].[Email]`) antes que `SELECT`/`LOOKUP` en columnas virtuales: los `SELECT` en virtual columns se recalculan en cada sync y son la causa nº 1 de apps lentas.
- **Blancos:** usa `ISBLANK()` / `ISNOTBLANK()` en lugar de comparar con `""`; las comparaciones con valores vacíos dan resultados inesperados.
- **Listas vs. valores:** `SELECT`, `FILTER` y `[Related …]` siempre devuelven listas. Para un valor usa `ANY()` o `INDEX(…, 1)` (no `TOP`, que también devuelve lista); para pertenencia, `IN()`.
- **Identificadores como Text:** documentos, PIN, códigos, ZIP, códigos FIPS/DANE y teléfonos van como Text/Phone, nunca Number (se pierden ceros y se rechazan letras). Si no se suma, no es Number.
- **Bots:** solo se disparan con cambios hechos desde la app, la API u otra automatización de AppSheet; las ediciones directas en la hoja de cálculo no los disparan. En eventos *Updates*, condiciona a la **transición** (`[_THISROW_BEFORE].[X] <> [_THISROW_AFTER].[X]`) para no repetir envíos.
- **Esquema estable:** no renombres ni borres encabezados de la hoja (usa *Display name*); añade columnas al final y regenera la estructura en ventanas sin cambios pendientes. Renombrar y regenerar borra la configuración de la columna y puede bloquear la sincronización offline.
- **Un solo origen para nombres de archivo:** cuando un bot genera un PDF, guarda el nombre (versionado) en una columna y úsalo tanto en la tarea como en la columna File, con *Disable timestamp* y rutas relativas.
- **Datos normalizados antes que fórmulas defensivas:** si una expresión falla por variantes de escritura ("Medellin"/"Medellín", "LA County"/"Los Angeles County"), la solución de fondo es normalizar los datos y usar catálogos con Ref, no complicar la fórmula.
- **No inventes.** Si no estás seguro de que una función, opción del editor o límite exista tal cual, dilo y sugiere verificarlo en la documentación oficial (support.google.com/appsheet) en lugar de afirmarlo.
