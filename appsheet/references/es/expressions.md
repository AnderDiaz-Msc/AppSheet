# Expresiones AppSheet

## Contenido
1. Sintaxis básica
2. Dónde se usan las expresiones (y qué deben devolver)
3. Funciones por categoría
4. Patrones frecuentes
5. Trampas comunes
6. Cómo depurar

## 1. Sintaxis básica

- Columna de la fila actual: `[Cantidad]`
- Columna de una fila referenciada (dereferencia): `[Cliente].[Email]` — solo funciona si `Cliente` es tipo Ref.
- Lista de valores de una columna de toda la tabla: `Productos[Nombre]`
- Dereferencia de lista: `[Related Detalles][Subtotal]` → lista de subtotales de las filas hijas.
- Fila actual dentro de un `SELECT`/`FILTER`: `[_THISROW].[Columna]` (dentro del filtro, `[Columna]` se refiere a la fila que se está evaluando de la otra tabla).
- En bots/condiciones de cambio: `[_THISROW_BEFORE].[Estado]` y `[_THISROW_AFTER].[Estado]`.
- Literales: texto `"abc"`, número `5`, decimal `5.0`, fecha `"2026-01-31"` o `DATE("01/31/2026")`, duración `"001:30:00"`, booleano `TRUE`/`FALSE`, lista `LIST(1,2)` o `{1, 2}`.
- Operadores: `+ - * / = <> < > <= >=`, `&` (concatena texto), `AND()`, `OR()`, `NOT()`.

## 2. Dónde se usan y qué deben devolver

| Campo | Devuelve | Notas |
|---|---|---|
| App formula | valor del tipo de la columna | Se recalcula al guardar la fila (y en sync si es virtual). La columna queda no editable. |
| Initial value | valor del tipo | Solo al crear la fila; el usuario puede cambiarlo. |
| Valid_If | Yes/No **o** lista | Si devuelve lista, se convierte en desplegable con esas opciones. |
| Show_If | Yes/No | Oculta la columna en formularios/detalle. No es seguridad. |
| Editable_If | Yes/No | |
| Required_If | Yes/No | |
| Slice row filter | Yes/No | Evaluado por fila. |
| Security filter | Yes/No | Filtra qué filas se descargan al dispositivo (seguridad real). |
| Format rule | Yes/No | |
| Action "Only if this condition is true" | Yes/No | |
| Bot condition (data change) | Yes/No | Puede usar `_THISROW_BEFORE/AFTER`. |
| Referenced rows (acción sobre conjunto) | lista de claves | Típicamente `SELECT(Tabla[Clave], …)` o `[Related X]`. |

## 3. Funciones por categoría

**Condicionales:** `IF(cond, sí, no)`, `IFS(c1, v1, c2, v2, …)` (sin "else"; usa `TRUE, valor` al final), `SWITCH(expr, v1, r1, v2, r2, …, defecto)`.

**Blancos:** `ISBLANK(x)`, `ISNOTBLANK(x)`.

**Búsqueda y listas de otras tablas:**
- `LOOKUP(valor, "Tabla", "ColBuscada", "ColDevuelta")` → un valor.
- `SELECT(Tabla[Col], condición, [distinto?])` → lista.
- `FILTER("Tabla", condición)` → lista de claves (equivale a `SELECT(Tabla[Clave], …)`).
- `REF_ROWS("TablaHija", "ColRefAlPadre")` → lista de filas hijas (lo genera AppSheet como `Related …`).
- `MAXROW("Tabla", "Col", [condición])` / `MINROW(...)` → clave de la fila con valor máx./mín.
- `ANY(lista)` → un elemento; `INDEX(lista, n)` → n-ésimo (base 1).

**Listas:** `COUNT`, `SUM`, `AVERAGE`, `MAX`, `MIN`, `IN(valor, lista)`, `ISNOTBLANK(lista)`, `UNIQUE(lista)`, `SORT(lista, [desc?])`, `TOP(lista, n)`, `LIST(...)`, `SPLIT(texto, ",")`, unión `lista1 + lista2`, diferencia `lista1 - lista2`, `INTERSECT(l1, l2)`.

**Texto:** `CONCATENATE(...)` o `&`, `TEXT(valor, "DD/MM/YYYY")`, `LEFT`, `RIGHT`, `MID`, `LEN`, `FIND`, `SUBSTITUTE`, `UPPER`, `LOWER`, `TRIM`, `CONTAINS(texto, sub)`, `STARTSWITH`, `ENDSWITH`, `NUMBER(texto)`, `UNIQUEID()`, `HYPERLINK(url, texto)`, `ENCODEURL(texto)`.

**Fechas y horas:** `TODAY()`, `NOW()`, `UTCNOW()`, `DATE(x)`, `TIME(x)`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY` (1=domingo), `WEEKNUM`, `EOMONTH(fecha, meses)`, `EWOMONTH`, `HOUR(duración)`, `MINUTE`, `TOTALHOURS(duración)`, `TOTALMINUTES`, `WORKDAY(fecha, días, [festivos])`, `NETWORKDAYS(ini, fin, [festivos])`. Fecha − fecha = Duration; fecha + número = fecha (+ días).

**Usuario y contexto:** `USEREMAIL()`, `USERNAME()`, `USERSETTINGS("Nombre")`, `CONTEXT("View")`, `CONTEXT("ViewType")`, `CONTEXT("Host")` (`"Browser"`/`"Device"`/`"Server"`), `CONTEXT("Device")`.

**Navegación (acciones App / columnas URL):** `LINKTOVIEW("Vista")`, `LINKTOROW([Clave], "Vista")`, `LINKTOFORM("Formulario", "Col", valor, …)`, `LINKTOFILTEREDVIEW("Vista", condición)`, `LINKURL(...)`.

**Matemáticas:** `ROUND(x, [dec])`, `FLOOR`, `CEILING`, `MOD`, `ABS`, `DECIMAL(x)`, `RANDBETWEEN`.

## 4. Patrones frecuentes

Total de un pedido a partir de sus líneas (en `Pedidos`, virtual column, Decimal):
```
SUM([Related Detalles][Subtotal])
```

Desplegable dependiente (Valid_If de `Detalles[Producto]`, solo productos de la categoría elegida):
```
SELECT(Productos[ID], [Categoria] = [_THISROW].[Categoria])
```

Evitar duplicados (Valid_If de `Clientes[Email]`):
```
NOT(IN([_THIS], SELECT(Clientes[Email], [ID] <> [_THISROW].[ID])))
```

Rol del usuario actual (con tabla `Usuarios` con columnas Email, Rol):
```
LOOKUP(USEREMAIL(), "Usuarios", "Email", "Rol")
```
Show_If solo para administradores:
```
LOOKUP(USEREMAIL(), "Usuarios", "Email", "Rol") = "Admin"
```

Último registro de un cliente (clave):
```
MAXROW("Visitas", "Fecha", [Cliente] = [_THISROW].[ID])
```

Número consecutivo legible (ojo: no es seguro con usuarios simultáneos u offline; úsalo como etiqueta, no como clave):
```
"PED-" & TEXT(COUNT(Pedidos[ID]) + 1)
```

Detectar cambio de estado en un bot:
```
AND([_THISROW_BEFORE].[Estado] <> [_THISROW_AFTER].[Estado], [_THISROW_AFTER].[Estado] = "Aprobado")
```

Edad o antigüedad en días:
```
HOUR(TODAY() - [FechaInicio]) / 24
```

## 5. Trampas comunes

- **División entera:** si ambos operandos son Number, `5/2 = 2`. Usa `DECIMAL([A]) / [B]` o `[A] * 1.0 / [B]`.
- **Comparar con vacío:** `[Col] = ""` da resultados inesperados (con el lado izquierdo vacío puede devolver TRUE). Usa `ISBLANK`.
- **`[_THISROW]` olvidado:** dentro de `SELECT`, `[Categoria] = [Categoria]` compara la fila consigo misma y siempre es TRUE.
- **Lista vs. valor único ("Cannot compare List with Text"):** `SELECT`, `FILTER` y `[Related …]` devuelven lista siempre. Usa `ANY()`/`INDEX(…,1)` para un valor, `IN()` para pertenencia e `ISNOTBLANK()` para "hay alguno". `TOP(lista, 1)` sigue siendo lista.
- **Comillas curvas** (“ ”) pegadas desde Word o WhatsApp invalidan la expresión; usa siempre `"` recta.
- **Identificadores tipo Number:** pierden ceros (`0123` → `123`) y rechazan letras. Usa Text (ver `troubleshooting.md` §3.1).
- **Tipos en comparaciones:** comparar una Ref (clave) con un nombre visible no coincide; compara clave con clave.
- **EnumList:** es una lista; usa `IN("valor", [MiEnumList])`, no `=`.
- **`CONTAINS` es para texto**, no para listas (para listas, `IN`).
- **`TEXT()` de fechas** depende de la configuración regional de la tabla; para formatos fijos especifica el patrón.
- **Fechas en Sheets:** si la hoja tiene otra configuración regional que la app, las fechas pueden invertir día/mes. Revisa la configuración regional de la hoja y de la tabla (Data › Table settings › Locale).
- **Rendimiento:** cada virtual column con `SELECT`/`FILTER`/`LOOKUP` se evalúa por fila en cada sync: N filas × M filas. Sustitúyelas por Ref + `REF_ROWS`, columnas físicas calculadas por acción/bot, o slices.

## 6. Cómo depurar

1. Abre el editor de expresiones y pulsa **Test** para ver el resultado en filas reales.
2. Divide la expresión: crea virtual columns temporales con cada parte.
3. Comprueba los tipos de columna (un Text que contiene números no suma).
4. Revisa *Manage › Monitor › Performance profile* / *Audit history* para problemas de sync o bots.
