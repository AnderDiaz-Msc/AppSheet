# Modelo de datos, UX y seguridad

## Contenido
1. Preparar la fuente de datos
2. Tablas, claves y referencias
3. Columnas virtuales vs físicas
4. Slices
5. Vistas
6. Acciones
7. Roles y seguridad
8. Rendimiento
9. Plantilla de diseño de app

## 1. Preparar la fuente de datos (Google Sheets / Excel)

- Una pestaña = una tabla. Encabezados en la fila 1, sin celdas combinadas, sin filas vacías intermedias, sin totales al final.
- Nombres de columna únicos y estables (renombrar después rompe expresiones).
- Evita fórmulas de hoja si la app escribe en esas filas; prefiere App formula. Las fórmulas de hoja solo se ven tras sincronizar.
- Configuración regional de la hoja coherente con la de la app (fechas y decimales).
- Una columna `ID` como primera columna para la clave.
- Documentos, PIN, códigos y teléfonos con formato de celda "Texto sin formato".
- Datos limpios y normalizados antes de crear la app (ver `sheet-normalization.md`).

**Cambios de estructura con la app en uso** (ver `troubleshooting.md` §2):
- Encabezados inmutables: para cambiar lo que ve el usuario, usa *Display name*. Renombrar y regenerar = columna nueva, y se pierde su configuración.
- Columnas nuevas al **final** de la hoja y *Regenerate structure* después.
- Cambios estructurales solo en ventanas de mantenimiento, cuando ningún dispositivo tenga cambios pendientes de sincronizar.

## 2. Tablas, claves y referencias

- **Normaliza:** una tabla por entidad (Clientes, Productos, Pedidos, Detalles). Los datos que se repiten van a su propia tabla y se referencian.
- **Clave:** columna `ID`, tipo Text, Initial value `UNIQUEID()`, oculta. Nunca `_RowNumber` (cambia si se borran filas) ni datos de negocio editables.
- **Label:** marca como *Label* la columna que el usuario reconoce (Nombre), para que las Ref se muestren bien.
- **Ref:** la columna hija guarda la clave del padre (`Pedidos[Cliente]` Ref → `Clientes`). AppSheet crea automáticamente en el padre la virtual column `Related Pedidos` = `REF_ROWS("Pedidos", "Cliente")`.
- **Is a part of:** activa esta opción en la Ref de la tabla hija (Detalles → Pedidos) para añadir líneas dentro del formulario del padre y borrar en cascada.
- **Muchos a muchos:** tabla intermedia con dos Ref (p. ej. `Asignaciones` con `Empleado` y `Proyecto`), o EnumList de Ref si la relación es simple y pequeña.
- **Tipos importan:** Email, Phone, Price, Percent, Image, File, LatLong, Address, Signature, Enum, EnumList, Yes/No, Ref, Duration… El tipo cambia el teclado, el formato y la validación.

## 3. Columnas virtuales vs físicas

| Usa virtual column cuando… | Usa columna física (+ App formula o acción) cuando… |
|---|---|
| El valor se deriva de la fila o de Ref directas y es barato | Necesitas el valor en la hoja (informes, otras herramientas) |
| Es solo para mostrar | El cálculo es costoso (SELECT sobre tablas grandes) |
| | El valor debe "congelarse" en el momento (precio al momento de venta) |

Para "congelar" un precio: columna física `PrecioUnitario` con Initial value `[Producto].[Precio]` (no App formula, que se recalcularía).

## 4. Slices

Subconjuntos filtrados de una tabla (filas, columnas y acciones permitidas). Úsalos para vistas por estado (Pendientes, Aprobados), "Mis registros" (`[Responsable] = USEREMAIL()`) y para limitar columnas en una vista. **No son seguridad:** los datos completos siguen en el dispositivo; para ocultar datos usa security filters.

## 5. Vistas

- Tipos: Deck, Table, Gallery, Detail, Form, Card, Map, Calendar, Chart, Dashboard, Onboarding.
- Posición: *primary* (barra inferior, máx. ~5), *menu*, *ref* (solo navegación interna).
- Agrupa (Group by) y ordena (Sort by) en la vista; usa Dashboard para combinar vistas.
- Format rules para colores/iconos por condición (p. ej. `[Estado] = "Vencido"` en rojo).
- Show_If de la vista para ocultarla por rol.

## 6. Acciones

- **App:** ir a otra vista/fila/formulario (`LINKTOROW`, `LINKTOFORM`…), copiar fila, editar, borrar.
- **Data:** *Set the values of some columns in this row*; *Add a new row to another table using values from this row*; *Execute an action on a set of rows* (referenced rows = lista de claves); *Delete*.
- **External:** llamar, SMS, email, abrir URL.
- **Grouped:** ejecuta varias acciones en secuencia.
- Configura posición (Prominent/Inline/Overlay/Hidden), condición "Only if this condition is true" y confirmación.
- Patrón "Aprobar": acción Data `Estado = "Aprobado"`, `FechaAprobacion = NOW()`, `AprobadoPor = USEREMAIL()`, visible solo si `AND([Estado] = "Pendiente", <es aprobador>)`.

## 7. Roles y seguridad

- Requiere inicio de sesión (Security › Require user signin) y lista de usuarios/dominio.
- Tabla `Usuarios` (Email clave, Nombre, Rol). Obtén el rol con `LOOKUP(USEREMAIL(), "Usuarios", "Email", "Rol")` o con una slice/virtual column en una tabla `Yo`.
- **Security filter** (Security › Security filters): p. ej. `OR([Responsable] = USEREMAIL(), LOOKUP(USEREMAIL(), "Usuarios", "Email", "Rol") = "Admin")`. Es la única forma de que un usuario no reciba filas.
- En la propia tabla `Usuarios`, evita un security filter que haga `LOOKUP` sobre `Usuarios` (es circular: el filtro necesita la tabla que está filtrando). Usa `[Email] = USEREMAIL()` y guarda la lista de administradores en otra tabla si deben ver todas las filas. Comprueba el comportamiento con *Preview app as*.
- Permisos de tabla: Are updates allowed? puede ser expresión: `IF(LOOKUP(USEREMAIL(), "Usuarios", "Email", "Rol") = "Admin", "ALL_CHANGES", "ADDS_ONLY")`.

## 8. Rendimiento

- Reduce virtual columns con SELECT/FILTER/LOOKUP; prefiere Ref y dereferencias.
- Usa security filters para no descargar datos innecesarios (con SQL/AppSheet Database se aplican en servidor).
- Archiva datos históricos en otra tabla/hoja.
- Activa *Delayed sync* y *Sync on start* según el caso; revisa *Performance profile* para ver qué expresiones cuestan.
- Imágenes: guárdalas como archivos (carpeta), no en base64, y baja *Image upload size* (*Settings › Views › General*) a medio o bajo para trabajo en campo.
- Distribuye solo los enlaces oficiales (*Users/Share › Links*), nunca URLs copiadas del editor ni de prototipo.

## 9. Plantilla de diseño de app

Al proponer una app completa, entrega:

1. **Tablas** (tabla markdown por tabla: Columna | Tipo | Clave/Label | Fórmula/Initial value | Notas).
2. **Relaciones** (qué Ref apunta a qué, cuáles son *Is a part of*).
3. **Slices** con su filtro.
4. **Vistas** (nombre, tipo, fuente, posición, agrupación).
5. **Acciones** con condición.
6. **Seguridad** (roles, security filters, permisos de tabla).
7. **Automatizaciones** si aplica (ver `automation.md`).
8. **Pasos de prueba.**
