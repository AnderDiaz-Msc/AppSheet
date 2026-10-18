# Diagnóstico de incidencias reales (síntoma → causa → solución)

Catálogo basado en incidencias reales encontradas al desarrollar apps AppSheet. Cuando el usuario describa un síntoma, búscalo aquí primero, confirma la causa con preguntas o comprobaciones concretas y luego aplica la solución.

## Contenido
1. Documentos PDF y plantillas
2. Estructura de datos, esquema y sincronización
3. Expresiones y tipos de datos
4. Apps Script, webhooks y APIs
5. Accesos, enlaces y rendimiento en campo
6. Matriz resumen

## 1. Documentos PDF y plantillas

### 1.1 Pantalla negra o "Path not found / Bad Request" al abrir un PDF generado
- **Causa:** no coinciden tres rutas: la *Folder path* de la tarea *Create a new file* del bot, la carpeta por defecto de la app (*Default app folder*, en la configuración de la app) y el texto que una acción escribe en la columna File. Pasa sobre todo con rutas absolutas de Drive, subcarpetas omitidas o el timestamp automático, que añade al nombre un sufijo imposible de predecir.
- **Solución:**
  1. Usa rutas **relativas** a la carpeta por defecto de la app en ambos sitios.
  2. Activa *Disable timestamp* en la tarea para controlar el nombre exacto.
  3. Construye el nombre con **una sola fuente de verdad**: guarda primero el nombre en una columna (p. ej. `[NombrePDF]`) y úsala tanto en *File name prefix* de la tarea como en la columna File:
```
Columna File:  "Reportes/" & [NombrePDF] & ".pdf"
Folder path:   "Reportes"     File name prefix:  <<[NombrePDF]>>
```
- **Comprobar:** abre la carpeta en Drive y compara carácter a carácter el nombre real del archivo con el valor de la columna.

### 1.2 Tras regenerar, el visor sigue mostrando el PDF antiguo
- **Causa:** caché del visor/navegador/servidor; con un nombre estático (`Reporte_[ID].pdf`) se sirve la copia guardada.
- **Solución:** versiona el nombre. **Ojo:** si el nombre lleva `NOW()` y se evalúa en dos sitios (bot y acción), los segundos no coincidirán y vuelve el error 1.1. Calcula la versión **una vez** y guárdala en `[NombrePDF] = "Reporte_" & [ID] & "_" & TEXT(NOW(), "YYYYMMDD_HHMMSS")`. El bot y la columna File leen esa columna. Otra opción es un contador `[VersionPDF] + 1`.
- **Dónde calcularlo (recomendado):** en la **misma acción del usuario que dispara el bot**, p. ej. una acción "Cerrar inspección" (Data: set the values) que fija `[Estado] = "Cerrada"` y `[NombrePDF]` a la vez. Así el valor ya está guardado cuando el bot arranca. Calcularlo en un paso *Run a data action* dentro del mismo bot puede funcionar, pero no garantices que los pasos siguientes vean el valor nuevo: si el usuario lo prefiere así, pídele que lo compruebe en el *Automation monitor*.
- **Formato de fecha:** en `TEXT()`, `MM` es mes o minutos según el contexto. Usa separadores (`"YYYYMMDD_HHMMSS"`) y verifica el resultado con *Test*.

### 1.3 El bot falla con "variable no encontrada / expresión inválida" en una plantilla que parece correcta
- **Causa:** Google Docs fragmenta internamente un marcador `<<[Columna]>>` cuando parte de él tiene otro formato (negrita, color o fuente en solo algunos caracteres, o texto pegado con formato). También quedan referencias huérfanas tras renombrar columnas, sobre todo dentro de `<<Start:…>>…<<End>>`.
- **Solución:** selecciona el marcador, *Formato › Borrar formato*, vuelve a escribirlo entero en texto plano y aplica el estilo al marcador completo. Audita cada marcador contra los nombres actuales de las columnas. Revisa el error exacto en *Monitor › Audit history*.

## 2. Estructura de datos, esquema y sincronización

### 2.1 Usuarios offline con registros atascados tras cambiar la hoja (alerta roja de sync)
- **Causa:** se cambió la estructura de la hoja (borrar, renombrar o reordenar columnas) o se regeneró el esquema mientras había dispositivos con cambios pendientes de una versión anterior. Los cambios en cola ya no encajan con la estructura nueva.
- **Matiz técnico:** AppSheet localiza las columnas por el **nombre del encabezado**, no solo por posición. Lo peligroso es renombrar o borrar columnas y regenerar con cambios en cola. Añadir columnas **al final** es la práctica más segura y evita efectos en fórmulas y rangos de la propia hoja.
- **Solución preventiva:** cambios de estructura solo en ventanas de mantenimiento, después de pedir a los usuarios que sincronicen y comprobar que no queda nada pendiente; columnas nuevas al extremo derecho; nunca renombrar ni borrar columnas en caliente.
- **Recuperación:** no borres datos de la app ni la reinstales en el dispositivo afectado (se pierde la cola). Revisa *Monitor › Audit history* para ver qué se intentó escribir. Si el cambio fue a una columna renombrada, restaurar temporalmente el nombre anterior puede dejar entrar la cola. Las opciones de recuperación dependen de la versión de AppSheet: verifica en la documentación actual.

### 2.2 Las columnas nuevas no aparecen en el editor, vistas ni bots
- **Causa:** AppSheet guarda una definición estática del esquema hasta que se regenera.
- **Solución:** *Data › Tabla › Regenerate structure* tras añadir columnas.
- **Trampa:** si **renombras** un encabezado y regeneras, AppSheet lo trata como una columna eliminada y otra nueva, y se pierden fórmulas, validaciones, Display name, etc. Deja los encabezados físicos inmutables y cambia la etiqueta visible con **Display name**.

### 2.3 Referencias rotas (triángulo amarillo en desplegables) o errores que desactivan la app
- **Causa:** se cambió la columna Key o Label, su tipo, o el nombre de columnas usadas en virtual columns, acciones, format rules o slices. Los hijos pierden el vínculo con el padre.
- **Solución:** clave exclusiva e inmutable con `UNIQUEID()`, separada de los datos de negocio; Label en otra columna. Para cambiar la clave de una tabla con datos, migra también las Ref de las tablas hijas.

## 3. Expresiones y tipos de datos

### 3.1 Se pierden los ceros iniciales (0123 → 123), aparecen separadores (1,234) o no se aceptan letras en PIN/documentos
- **Causa:** columna tipo Number (en AppSheet y/o en el formato de celda) para algo que es un **identificador**, no una cantidad.
- **Solución:** tipo Text (o Phone para teléfonos) en AppSheet **y** formato "Texto sin formato" en la hoja; recupera los ceros perdidos (ver `sheet-normalization.md`). Valida con Valid_If:
```
AND(LEN([_THIS]) = 4, ISNOTBLANK(NUMBER([_THIS])))
```
(PIN numérico de 4 dígitos guardado como texto. Si debe ser alfanumérico, valida solo la longitud. Prueba con *Test* que `NUMBER()` se comporte como esperas con ceros iniciales.)
- **Regla general:** si no vas a sumarlo ni promediarlo, no es Number.

### 3.2 "Cannot compare List with Text", o filtros/Show_If vacíos sin motivo aparente
- **Causa:** `SELECT()`, `FILTER()` y `[Related …]` devuelven **siempre una lista** (aunque tenga 0 o 1 elemento), y se comparó con `=` contra un valor único. También pasa con comillas tipográficas curvas (“ ” pegadas desde Word/WhatsApp) y con paréntesis desbalanceados en `IFS`/`AND`/`OR` anidados.
- **Solución:**
```
Un valor:      ANY(SELECT(Tabla[Col], cond))     o  INDEX(SELECT(...), 1)
Pertenencia:   IN([Valor], SELECT(Tabla[Col], cond))
¿Hay alguno?:  ISNOTBLANK(SELECT(...))           o  COUNT(SELECT(...)) > 0
```
- **Corrección al registro original:** `TOP(lista, 1)` **sigue devolviendo una lista**; no sirve para obtener un escalar. Usa `ANY()` o `INDEX(…, 1)`.
- Sustituye las comillas curvas por rectas `"` y reescribe la expresión en el editor.

### 3.3 Bots que se disparan en cada edición, o semáforos/estados que no cambian
- **Causa:** la condición de un evento *Updates* evalúa solo el estado actual (`[Estado] = "Aprobado"`), así que cualquier edición posterior de otra columna la vuelve a cumplir. En flujos por etapas, `Show_If`/`Editable_If`/format rules no contemplan estados intermedios ni el rol.
- **Solución:** detecta la **transición**:
```
AND([_THISROW_BEFORE].[Estado] <> [_THISROW_AFTER].[Estado], [_THISROW_AFTER].[Estado] = "Aprobado")
```
- Con *Adds and Updates* la misma condición también cubre las filas creadas ya en "Aprobado": al crear, `[_THISROW_BEFORE].[Estado]` está vacío y por tanto es distinto del nuevo valor. Verifícalo con un registro de prueba.
- Si un registro puede salir de "Aprobado" y volver a entrar, el bot se dispararía de nuevo. Si solo debe notificarse una vez en la vida del registro, añade una columna Yes/No `[Notificado]` que el bot marque (Run a data action) y exígela en la condición: `NOT([_THISROW_AFTER].[Notificado])`.

Para etapas, define la lista completa de estados (Enum) y escribe las condiciones por estado y rol, p. ej. `AND([Estado] = "En revisión", <rol> = "Revisor")`. Comprueba que las format rules usan exactamente los mismos valores del Enum.

## 4. Apps Script, webhooks y APIs

### 4.1 Tras corregir el Apps Script, AppSheet sigue ejecutando el código viejo
- **Causa (con *Call a webhook* a una URL de aplicación web `/exec`):** guardar solo actualiza el borrador (HEAD). La URL `/exec` ejecuta la versión **implementada**, que sigue congelada.
- **Solución:** *Implementar › Gestionar implementaciones › editar (lápiz) › Versión: Nueva versión › Implementar*. Se conserva la misma URL.
- **Trampas:** *Nueva implementación* (en vez de editar la existente) crea **otra URL**, y habría que cambiarla en el webhook. La URL `/dev` ejecuta HEAD pero exige sesión del propietario, así que AppSheet no puede usarla. En la implementación, "Quién tiene acceso" debe permitir llamadas sin sesión de Google (*Cualquier usuario*); si no, el webhook recibe una página de login o un 401/403.
- **Comprobar:** en Apps Script, *Ejecuciones* muestra si llegó la llamada y con qué error; en AppSheet, el *Automation monitor*.
- **Matiz:** con la tarea *Call a script* (sin URL de web app) no hay implementación que actualizar. Si cambias el nombre o los parámetros de la función, vuelve a seleccionarla en la tarea para que AppSheet relea la firma, y vuelve a autorizar si pide permisos nuevos.

### 4.2 Webhook con HTTP 400 o `SyntaxError: Unexpected token` en `JSON.parse(e.postData.contents)`
- **Causa:** texto libre con comillas dobles, saltos de línea o barras invertidas insertado tal cual en la plantilla JSON (`"obs": "<<[Observaciones]>>"`) rompe la sintaxis.
- **Corrección al registro original:** no hay una función `:json` documentada en las plantillas de AppSheet; no la recomiendes como si existiera.
- **Soluciones, de más a menos robusta:**
  1. Envía solo la clave (`{"id": "<<[ID]>>"}`) y que el receptor lea la fila completa con la AppSheet API.
  2. Codifica el texto con `ENCODEURL()` y decodifícalo en el receptor. `ENCODEURL` convierte comillas, saltos de línea y barras en secuencias `%XX`, que son seguras dentro de una cadena JSON:
```
Body:    {"id": "<<[ID]>>", "obs": "<<ENCODEURL([Observaciones])>>"}
Script:  var obs = decodeURIComponent(String(data.obs).replace(/\+/g, ' '));
```
     (El `replace` cubre el caso de que los espacios lleguen como `+`. Prueba con un texto que tenga comillas, varias líneas, `\`, tildes y `%`.)
  3. Usa la tarea *Call a script* en lugar de un webhook: AppSheet pasa cada valor como parámetro de la función, sin JSON de por medio.
  4. Sanea el texto con `SUBSTITUTE()` anidados (comillas dobles → simples, saltos de línea → espacio) en una virtual column. Es la opción más frágil: prueba con *Test* cómo escribir los literales de comilla y salto de línea en tu versión.

  Además, un `try/catch` en el script no arregla nada: el cuerpo ya llega roto. Corrige en el origen.
- **Diagnóstico:** registra el cuerpo crudo al inicio de `doPost` antes de parsearlo:
```javascript
function doPost(e) {
  var raw = e && e.postData ? e.postData.contents : '';
  SpreadsheetApp.openById(LOG_ID).getSheetByName('Log').appendRow([new Date(), raw]);
  var data = JSON.parse(raw);
  // ...
}
```

## 5. Accesos, enlaces y rendimiento en campo

### 5.1 Acceso denegado o usuarios con una versión desactualizada
- **Causa:** se distribuyeron enlaces copiados del navegador durante pruebas (del editor o de prototipo), o cambió el ID de la app tras clonarla o transferirla. Al transferir la propiedad, las hojas y carpetas de imágenes en el Drive del creador anterior quedan sin permisos para el nuevo propietario.
- **Solución:** distribuye solo los enlaces oficiales de *Users/Share › Links* (Install link / Browser link). Comparte las hojas y carpetas con la cuenta propietaria con permiso de edición antes de transferir. Revisa si la app accede a los datos como el creador (lo habitual) o con las credenciales de cada usuario: en este último caso, **cada usuario** necesita permiso sobre los archivos. Confirma el nombre exacto de la opción en tu versión del editor.

### 5.2 La app tarda minutos en abrir, las listas van lentas o la sync falla por timeout en campo
- **Causa:** fotos subidas a resolución completa y vistas que descargan cientos o miles de registros históricos sin filtrar.
- **Solución:** baja *Image upload size* (*Settings › Views › General*) a medio o bajo; usa **security filters** para descargar solo los registros activos o asignados al usuario (las slices solo ocultan, no reducen la descarga); archiva el histórico; activa *Delayed sync* y las actualizaciones en segundo plano; revisa *Performance profile*.

## 6. Matriz resumen

| Categoría | Síntoma | Causa | Solución |
|---|---|---|---|
| PDF | Pantalla negra / ruta no encontrada | Rutas desalineadas entre bot, carpeta de la app y columna File | Rutas relativas, *Disable timestamp*, nombre guardado en una columna |
| PDF | Se ve la versión antigua | Caché por nombre estático | Nombre versionado calculado **una sola vez** |
| Plantillas | Variables no encontradas | Formato parcial que fragmenta `<<…>>`; columnas renombradas | Borrar formato, reescribir el marcador, auditar nombres |
| Esquema | Sync bloqueada offline | Cambio de estructura con cambios en cola | Ventanas de mantenimiento, columnas al final, nunca renombrar en caliente |
| Esquema | Columnas nuevas invisibles / configuración perdida | Esquema estático; renombrar = columna nueva | Regenerate structure; Display name en vez de renombrar |
| Tipos | Ceros perdidos, letras rechazadas | Number para identificadores | Text/Phone + formato texto en la hoja |
| Expresiones | Cannot compare List with Text | Comparar una lista con `=` | `ANY`, `INDEX(…,1)`, `IN`, `ISNOTBLANK` (no `TOP`) |
| Bots | Disparos repetidos | Condición sin transición | `_THISROW_BEFORE <> _THISROW_AFTER` + estado destino |
| Apps Script | Corre código viejo | Web app sin nueva versión implementada | Gestionar implementaciones › Nueva versión |
| Webhook | HTTP 400 / JSON inválido | Texto libre sin escapar | Enviar solo la clave, `ENCODEURL` + `decodeURIComponent`, o *Call a script*; registrar el cuerpo crudo |
| Accesos | Acceso denegado / versión vieja | Enlaces de prueba; permisos de Drive tras transferir | Enlaces oficiales; compartir carpetas con el propietario |
| Rendimiento | Lento / timeouts | Fotos pesadas, datos sin filtrar | Image upload size, security filters, Delayed sync |
