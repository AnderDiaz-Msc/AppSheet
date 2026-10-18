# Normalizar una hoja de cálculo como base de datos para AppSheet

## Contenido
1. Por qué importa
2. Flujo de trabajo
3. Diagnóstico de la hoja
4. Reglas por tipo de dato
5. Datos geográficos jerárquicos
6. Reestructurar en tablas (modelo relacional)
7. Herramientas incluidas
8. Entregable al usuario

## 1. Por qué importa

AppSheet trata la hoja como una base de datos. Los datos "sucios" causan errores visibles en la app: los Ref se rompen porque "Medellin" ≠ "Medellín", los totales salen mal porque "1.053" se lee como 1,053, se pierden ceros en documentos o PIN tipados como Number y los filtros fallan por espacios extra. Normalizar antes de construir (o antes de una migración) evita la mayoría de incidencias de `troubleshooting.md` §2-3.

## 2. Flujo de trabajo

1. **Copia de seguridad.** Duplica el archivo o trabaja en una pestaña nueva. Nunca normalices sobre los datos vivos que usa una app en producción.
2. **Diagnóstico** (§3): inventario de columnas, tipo real de cada una y problemas detectados con ejemplos.
3. **Propuesta de reglas** por columna (§4-5). Muéstrala al usuario y confírmala antes de aplicar, sobre todo la interpretación de números y fechas: es ambigua y un error silencioso corrompe datos. Si no puedes preguntar (p. ej. te pidieron el archivo terminado), aplica la interpretación con más evidencia y escríbela como **suposición** al principio del reporte.
4. **Aplicar** con el script (§7) o con fórmulas. El resultado va a una pestaña nueva y genera un reporte de cambios.
5. **Revisión humana** de lo marcado "revisar" (coincidencias aproximadas, valores ambiguos, no encontrados). No adivines: un municipio mal asignado es peor que uno vacío y marcado. Tampoco destruyas datos: nunca dejes en blanco ni borres un valor dudoso (una fecha imposible, un ZIP de otro estado, una fila duplicada). Déjalo como estaba, o con la corrección propuesta, y márcalo; quien revisa necesita el original para decidir.
6. **Reestructurar** en tablas si hace falta (§6).
7. **Reemplazar y regenerar:** en una ventana sin usuarios con cambios pendientes, sustituye los datos, verifica que los encabezados no cambiaron de nombre (o planifica el cambio, ver `troubleshooting.md` §2) y ejecuta *Regenerate structure* en AppSheet.

## 3. Diagnóstico

Por cada columna, informa:
- Tipo AppSheet propuesto (Text, Number, Decimal, Price, Date, Email, Phone, Enum, Ref…).
- % de vacíos y número de valores distintos. Pocos valores distintos indican un candidato a Enum o a tabla catálogo.
- Problemas, con 2-3 ejemplos reales: espacios dobles o finales, mayúsculas inconsistentes, variantes de un mismo valor, separadores de miles/decimales mezclados, fechas en varios formatos, celdas combinadas, totales o filas vacías intermedias, varias cosas en una celda ("Medellín - Antioquia"), encabezados duplicados o con saltos de línea.
- Columna clave candidata (única y sin vacíos). Si no existe, propone añadir `ID` con `UNIQUEID()`.

Si tienes acceso al archivo (CSV/XLSX), analízalo tú (con Node, o con la skill `xlsx` para Excel). Si no, pide al usuario una muestra de ~20 filas con los encabezados.

## 4. Reglas por tipo de dato

| Tipo | Regla | Ejemplo |
|---|---|---|
| Nombres propios (personas, lugares, veredas) | Espacios limpios, mayúscula inicial; partículas (de, del, la, y…) en minúscula salvo al inicio; siglas con punto en mayúscula; conservar tildes y ñ | `jUAN DE la torre` → `Juan de la Torre`; `bogotá, d.c.` → `Bogotá, D.C.` |
| Números (cantidades, valores) | Quitar símbolos de moneda, espacios y separador de miles; dejar el número puro. Decidir el separador decimal **por columna** con evidencia | `1.053` → `1053`; `$ 2.400.000` → `2400000`; `1.053,75` → `1053.75` |
| Identificadores, documentos, NIT, PIN, códigos, códigos DANE, ZIP | **Texto** con ceros a la izquierda; formato de celda "Texto sin formato". Los numéricos pierden puntos y espacios; los alfanuméricos (`A-001`) **no se tocan**: cambiar una clave rompe las referencias de otras tablas | `1.053.456` → `1053456`; `05001` se queda `05001`; `A-001` se queda `A-001` |
| Teléfonos | Texto, solo dígitos y `+` inicial (tipo Phone en AppSheet) | `+57 (300) 123-4567` → `+573001234567` |
| Email | Minúsculas, sin espacios, validar formato | |
| Fechas | Una sola interpretación por columna (DMY en Latinoamérica); celda con formato fecha real, no texto; marcar las inválidas | `05/03/2024` = 5 de marzo |
| Categorías (estado, tipo) | Lista cerrada de valores → Enum o tabla catálogo; unificar variantes | `activo`, `Activo `, `ACTIVO` → `Activo` |
| Texto libre (observaciones) | Solo limpiar espacios; no cambiar mayúsculas | |

**Ambigüedad numérica (la regla más importante):** `1.053` es mil cincuenta y tres en es-CO, pero 1,053 en en-US. Decide por columna con evidencia:
- Valores como `2.400.000` o `1.053,5` → el punto es separador de miles.
- Valores como `12.5` o `1,053.5` → el punto es decimal.
- Si la columna representa cantidades enteras (unidades, habitantes, pesos colombianos), `1.053` casi seguro es 1053.
- Si no hay evidencia suficiente, pregunta.

Cuidado también con los números que ya se corrompieron al importar: si Sheets ya convirtió `1.053` en el número 1,053, el texto original se perdió. Señal: valores con exactamente 3 decimales en una columna de enteros. Márcalos para revisión, no los "arregles" a ciegas.

Configuración regional: revisa *Archivo › Configuración › Configuración regional* de la hoja y el *Locale* de la tabla en AppSheet. Deben coincidir con cómo se escriben los datos.

## 5. Datos geográficos jerárquicos

Jerarquías típicas: Colombia: Departamento › Municipio › Corregimiento/Centro poblado › Vereda. México/Venezuela: Estado › Municipio › Parroquia/Localidad. Estados Unidos: State › County › City/Town (ver §5.1). Normalízalos así:

1. **Separa** las celdas que mezclan niveles (`Rionegro, Antioquia` → dos columnas).
2. **Catálogo oficial** para los niveles que lo tienen: en Colombia, DIVIPOLA del DANE (departamentos y municipios con códigos de 2 y 5 dígitos; disponible en datos.gov.co); en México, el catálogo de INEGI. Importa el catálogo a pestañas `Cat_Departamentos` y `Cat_Municipios` (Codigo | Nombre | Padre | Alias). Los alias recogen nombres comunes: `Bogota`, `Distrito Capital`, `Santiago de Cali`.
3. **Empareja de arriba abajo:** primero el nivel superior y luego el inferior **dentro de su padre**. Hay nombres repetidos en distintos departamentos (Rionegro está en Antioquia y en Santander; hay varios "San Luis", "Sucre"…), así que emparejar un municipio sin su departamento da resultados ambiguos.
4. **Comparación tolerante:** ignora tildes, mayúsculas, puntuación y prefijos ("Municipio de", "Vereda", "Corregimiento"). Las coincidencias aproximadas (`Medelin` → `Medellín`) se proponen, pero se marcan para revisión.
5. **Guarda el código**, no solo el nombre: añade `Departamento_Codigo`, `Municipio_Codigo` (texto, con ceros) al final de la tabla. El código es estable y sirve de clave para los Ref.
6. **Niveles sin catálogo oficial** (veredas, corregimientos y barrios suelen no tener uno completo): agrupa las variantes de escritura **dentro del mismo municipio**, propone la forma más frecuente como canónica y deja que el usuario confirme. Con el resultado, crea una tabla catálogo propia (`Veredas`: ID, Nombre, Municipio_Codigo).

**En AppSheet** (ver `data-modeling.md`): tablas `Departamentos` (clave Codigo), `Municipios` (clave Codigo, Ref a Departamentos) y `Veredas` (Ref a Municipios). En la tabla de registros, usa columnas Ref con desplegables dependientes:
```
Valid_If de [Municipio]:  SELECT(Municipios[Codigo], [Departamento] = [_THISROW].[Departamento])
Valid_If de [Vereda]:     SELECT(Veredas[ID], [Municipio] = [_THISROW].[Municipio])
```
Marca `Nombre` como Label en cada catálogo para que el usuario vea nombres y la app guarde códigos.

### 5.1 Datos de Estados Unidos

Si los datos son de EE. UU. (o el usuario escribe en inglés y no indica otro país), cambian las convenciones:
- **Números:** coma de miles y punto decimal (`$1,053.50` → `1053.5`). El caso ambiguo se invierte: `1,053` es mil cincuenta y tres.
- **Fechas:** MM/DD/YYYY (`03/05/2024` = 5 de marzo).
- **Geografía:** State › County › City/Town. Catálogo oficial: códigos **FIPS** del Census Bureau (estado de 2 dígitos, condado de 5: `06037` = Los Angeles County, California). Alias útiles: abreviaturas postales (`CA`, `NY`, `TX`). Hay condados homónimos en muchos estados ("Washington County" existe en una treintena de estados), así que siempre se empareja dentro del estado. Los sufijos `County`, `Parish` (Luisiana) y `Borough` (Alaska) se ignoran al comparar; `City` no, porque forma parte del nombre (Carson City, Jersey City).
- **Ciudades:** el Census publica un catálogo de *places* (código de 7 dígitos: estado + lugar), pero la ciudad postal de una dirección no siempre es un *place* oficial, y algunos *places* abarcan varios condados (si usas ese catálogo, su padre es el estado, no el condado). Si no lo usas, agrupa variantes dentro de cada condado, como con las veredas.
- **ZIP:** texto de 5 dígitos. Es el caso clásico de cero perdido: `02134` (Boston) se convierte en `2134` al abrirlo en Excel/Sheets. Con `{"tipo": "id", "longitud": 5, "longitudes": [5, 5], "unico": false, "zipEstado": "State"}` se recuperan los ceros, se marcan los que no tienen 5 dígitos y los ZIP cuyo primer dígito no corresponde al estado de la fila (p. ej. un `02134` de Boston en una fila de California). Esa entrada va **después** de la columna geo del estado. Rellenar un cero puede ser un error si el original simplemente estaba mal escrito, y eso es justo lo que detecta la comprobación de estado. Si hay ZIP+4 (`02134-1234`), usa tipo `texto`.
- **Nombres:** `McDonald`, `O'Brien`, `Jr.`, `III`; partículas como `van`, `von`, `de` en minúscula salvo al inicio.
- **Teléfonos:** 10 dígitos; `+1` opcional y consistente.
- **Identificadores personales (SSN):** datos sensibles. Si aparecen, recomienda no guardarlos en la app o limitarlos con security filters.

## 6. Reestructurar en tablas

Si la hoja es una "sábana" (una fila con cliente, producto, ubicación y transacción mezclados):
- Extrae cada entidad repetida a su propia pestaña con clave (`Clientes`, `Productos`, `Ubicaciones`).
- Sustituye en la tabla principal los datos repetidos por la clave (columna Ref).
- Columnas repetidas (`Producto1`, `Producto2`, `Producto3`) → tabla hija con una fila por elemento (*Is a part of*).
- Una celda con varios valores separados por comas → tabla hija, o EnumList si son pocos y de lista cerrada.

## 7. Herramientas incluidas

- `scripts/normalizacion-core.js`: funciones puras (nombres propios, números, IDs, teléfonos, fechas, emparejamiento geográfico con catálogo, agrupación de variantes y `normalizarTabla` para una tabla completa). Funciona en Node y en Apps Script. Además de normalizar, **marca para revisión** los números fuera de escala (≥100 veces la mediana: el típico "1.053" que era "1.053.000"), los números que Sheets ya corrompió, y los identificadores duplicados, de longitud atípica o con cero inicial poco habitual. Si conoces el rango válido, pásalo: `{"tipo": "id", "longitudes": [6, 10]}` para cédulas colombianas.
- `scripts/normalizar-csv.js`: **úsalo para archivos CSV locales en lugar de escribir tu propio script.** `node scripts/normalizar-csv.js datos.csv config.json carpeta_salida`. El `config.json` lleva `{"columnas": [...], "catalogos": {"Cat_Municipios": "cat_municipios.csv"}}` (rutas relativas al config). Detecta el separador `,`/`;` y escribe `datos_normalizados.csv` (UTF-8 con BOM), `reporte_normalizacion.md` y `reporte.json`. Después completa el reporte con tu análisis: suposiciones, por qué cada pendiente importa y pasos en AppSheet. Para Excel, convierte antes a CSV (skill `xlsx`).
- `scripts/normalizar-hoja.gs`: menú "Normalizar" en Google Sheets. Se configura con el objeto `CONFIG` (hoja, columnas y tipo de cada una), escribe `<Hoja>_normalizada` sin tocar el original y genera `Reporte_normalizacion` con lo que hay que revisar en amarillo. Las instrucciones de instalación están en la cabecera del archivo. Su equivalente en inglés es `scripts/normalize-sheet.gs` (menú "Normalize"); se pega uno de los dos, no ambos.
- **Idioma de los scripts:** `normalizarTabla(..., {idioma: 'en'})`, o `"language": "en"` en el `config.json`, produce mensajes en inglés, columnas `_Code` y, por defecto, fechas MDY y punto decimal. Los tipos y opciones aceptan nombres en inglés (`proper_name`, `number`, `phone`, `date`, `cluster`, `column`, `type`, `catalog`, `parent`, `addCode`…). Usa el idioma del usuario.
- `scripts/test-normalizacion.js` y `scripts/test-normalizar-hoja.js`: pruebas (`node scripts/test-normalizacion.js`). Ejecútalas si modificas los scripts.

Para fórmulas sin script en Sheets: `=PROPER(TRIM(A2))` (no respeta partículas), `=VALUE(SUBSTITUTE(A2;".";""))` para quitar miles en es-CO (en hojas con configuración regional en español el separador de argumentos es `;`; en inglés, `,`).

## 8. Entregable al usuario

1. Diagnóstico (tabla: Columna | Tipo propuesto | Problemas | Ejemplos).
2. Reglas que se aplicarán (y las suposiciones, sobre todo de números y fechas).
3. El `CONFIG` listo para el script, o la hoja normalizada si tienes el archivo.
4. Resumen del reporte: cuántas celdas se corrigieron y cuántas hay que revisar, con los casos más relevantes.
5. Siguientes pasos en AppSheet: tipos de columna, catálogos, Ref, Valid_If dependientes y Regenerate structure.
