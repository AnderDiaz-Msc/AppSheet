# API e integraciones

## Contenido
1. AppSheet API v2
2. Llamar a servicios externos desde AppSheet (webhooks)
3. Google Apps Script
4. n8n
5. Seguridad

## 1. AppSheet API v2

**Habilitar:** *Settings › Integrations › IN: from cloud services to your app* → activar API y crear una **Application Access Key**. Anota el **App ID** (en la misma pantalla).

**Endpoint:**
```
POST https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
```
(Para apps en otras regiones puede ser `https://www.appsheet.com/...` o un dominio regional; si da 404/403, revisa la URL que muestra el propio editor.)

**Cabeceras:**
```
ApplicationAccessKey: <clave>
Content-Type: application/json
```
(También se acepta `?applicationAccessKey=<clave>` en la URL, pero la cabecera es preferible para no exponerla en logs.)

**Cuerpo:**
```json
{
  "Action": "Add",
  "Properties": {
    "Locale": "es-ES",
    "Timezone": "Europe/Madrid",
    "RunAsUserEmail": "usuario@dominio.com"
  },
  "Rows": [
    { "ID": "abc123", "Cliente": "c-001", "Estado": "Pendiente" }
  ]
}
```

| Action | Rows |
|---|---|
| `Add` | Filas nuevas (incluye la clave o deja que el Initial value la genere). |
| `Edit` | Filas con la clave + columnas a cambiar. |
| `Delete` | Filas con solo la clave. |
| `Find` | Vacío `[]` para todas, o usa `Properties.Selector`. |
| `"<Nombre de acción>"` | Ejecuta una acción de la app sobre las filas indicadas por clave. |

**Filtrar en Find:**
```json
"Properties": { "Selector": "Filter(Pedidos, [Estado] = \"Pendiente\")" }
```
También: `"Select(Pedidos[ID], [Total] > 100, true)"`, `"OrderBy(Filter(...), [Fecha], true)"`, `"Top(OrderBy(...), 10)"`.

Notas:
- `Locale` afecta al formato de fechas/números que envías y recibes; sé consistente.
- `RunAsUserEmail` hace que `USEREMAIL()` y los security filters se evalúen como ese usuario.
- Los cambios hechos por API **sí** disparan bots.
- La API puede estar limitada según el plan de AppSheet; verifica la disponibilidad en la cuenta del usuario.

Ejemplo curl:
```bash
curl -X POST "https://api.appsheet.com/api/v2/apps/$APP_ID/tables/Pedidos/Action" \
  -H "ApplicationAccessKey: $APPSHEET_KEY" -H "Content-Type: application/json" \
  -d '{"Action":"Find","Properties":{"Locale":"es-ES"},"Rows":[]}'
```

## 2. Webhooks desde AppSheet

Task *Call a webhook* en un bot:
- URL (puede contener expresiones `<<[ID]>>`), método HTTP, cabeceras (p. ej. token), cuerpo JSON con plantilla (ver `automation.md` §5).
- Activa *Return value* si quieres usar la respuesta en pasos posteriores.
- Para llamar a la propia AppSheet API de otra app, existe el preset "AppSheet API" en la task.

## 3. Google Apps Script

Task *Call a script*:
1. Crea un proyecto de Apps Script con una función, p. ej.:
```javascript
function crearEvento(titulo, inicio, fin, email) {
  const ev = CalendarApp.getDefaultCalendar().createEvent(titulo, new Date(inicio), new Date(fin), {guests: email});
  return ev.getId();
}
```
2. En la task, elige el proyecto y la función; asigna cada parámetro con una expresión (`[Titulo]`, `[Inicio]`…).
3. Si la función devuelve valor, activa *Return value* y úsalo luego como `[NombrePaso].[Output]` (p. ej. para guardar el ID del evento en la fila con una acción).
4. La primera vez hay que autorizar los permisos del script.

**Web app de Apps Script como receptor de un webhook** (`doPost(e)` en una URL `.../exec`):
- Tras cada cambio de código: *Implementar › Gestionar implementaciones › editar › Nueva versión › Implementar*. Guardar no basta: `/exec` sigue ejecutando la versión implementada anterior. La URL se conserva.
- Registra `e.postData.contents` en una hoja de log antes de `JSON.parse`, para ver qué llegó realmente (ver `troubleshooting.md` §4).
- Con *Call a script* no hay implementación: si cambias el nombre o los parámetros de la función, vuelve a seleccionarla en la tarea.

Para que un script **escriba en AppSheet disparando bots**, que llame a la AppSheet API con `UrlFetchApp.fetch` en vez de escribir en la hoja.

## 4. n8n

Si están instaladas, usa también las skills de n8n (`n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-expression-syntax`) para construir el flujo.

**AppSheet → n8n:** nodo *Webhook* en n8n (método POST, copia la URL de producción) → en AppSheet, task *Call a webhook* a esa URL con cuerpo JSON. En n8n los datos llegan en `{{ $json.body.<campo> }}`. Protege el webhook con una cabecera secreta (Header Auth).

**n8n → AppSheet:** nodo *HTTP Request*:
- Method POST, URL `https://api.appsheet.com/api/v2/apps/<APP_ID>/tables/<Tabla>/Action`
- Header `ApplicationAccessKey` (guárdalo como credencial *Header Auth*, no en texto plano)
- Body JSON con `Action`, `Properties`, `Rows` como arriba.
- La respuesta de `Find` es un array de filas (en algunos casos envuelto); inspecciona la salida antes de mapearla.

## 5. Seguridad

- No pegues Access Keys en plantillas visibles, columnas de la app ni código compartido; usa propiedades del script (`PropertiesService`) o credenciales de n8n.
- Regenera la clave si se expone.
- Valida en el receptor que el webhook viene de AppSheet (token secreto en cabecera).
