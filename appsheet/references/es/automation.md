# Automatizaciones (Bots)

## Contenido
1. Estructura: Bot → Event → Process → Steps → Tasks
2. Eventos
3. Pasos del proceso
4. Tareas
5. Plantillas (email, PDF, documentos)
6. Patrones
7. Problemas frecuentes

## 1. Estructura

En *Automation*:
- **Bot**: une un evento con un proceso. Se puede activar/desactivar.
- **Event**: qué lo dispara (cambio de datos o programación).
- **Process**: secuencia de **steps**.
- **Step**: ejecutar una task, ramificar con condición, esperar, llamar a otro proceso, devolver valores.
- **Task**: la acción concreta (email, notificación, webhook, script, archivo, acción de datos).

## 2. Eventos

**Data change:** tabla + tipo (Adds, Updates, Deletes, o combinación) + condición opcional (Yes/No). En la condición puedes usar `[_THISROW_BEFORE]` y `[_THISROW_AFTER]`.

Ejemplo — solo cuando el estado pasa a "Aprobado":
```
AND([_THISROW_BEFORE].[Estado] <> "Aprobado", [_THISROW_AFTER].[Estado] = "Aprobado")
```

**Schedule:** diario, semanal, mensual, etc., con hora y zona horaria. Puede ejecutarse **ForEachRowInTable** con una tabla/slice y condición de filtro, para procesar cada fila que cumpla (p. ej. recordatorios de vencimientos):
```
AND([Estado] <> "Pagado", [FechaVencimiento] = TODAY() + 3)
```

**Qué dispara un evento Data change:** cambios hechos desde la app, desde la AppSheet API y desde acciones/otros bots. **No** lo disparan las ediciones directas en Google Sheets/Excel ni scripts que escriban en la hoja. Si el usuario necesita eso, opciones: escribir vía AppSheet API desde Apps Script, o usar un bot programado que revise filas.

## 3. Pasos del proceso

- **Run a task**: ejecuta una task.
- **Branch on a condition**: si/no con expresión sobre la fila.
- **Wait**: espera un tiempo o hasta una condición.
- **Call a process**: reutiliza otro proceso (puede ejecutarse sobre otra tabla, p. ej. sobre filas relacionadas).
- **Return values**: devuelve valores al proceso que lo llamó.

Los resultados de tareas anteriores (p. ej. de *Call a script* o *Call a webhook* con "Return value") se usan después como `[NombreDelPaso].[Output]` (o el nombre del campo devuelto).

## 4. Tareas

| Tarea | Uso |
|---|---|
| Send an email | Destinatarios con expresión (`[Cliente].[Email]`, `LIST(...)`), asunto, cuerpo, adjuntos (PDF generado desde plantilla). |
| Send a notification | Push a usuarios de la app (requiere que tengan la app instalada y notificaciones activadas). |
| Send an SMS | |
| Call a webhook | HTTP a un servicio externo (n8n, Make, API propia). Cuerpo JSON con plantilla. |
| Create a new file | Genera PDF/CSV/HTML/XLSX/JSON a partir de una plantilla y lo guarda en una carpeta. |
| Call a script | Ejecuta una función de Google Apps Script con parámetros; puede devolver valor. |
| Run a data action | Ejecuta una acción de la app (set values, add row…) sobre la fila. |

## 5. Plantillas

Las plantillas (Google Docs para email/PDF, o texto/JSON en el editor) usan marcadores `<<…>>`:

- Valor: `<<[NombreCliente]>>`, `<<[Cliente].[Email]>>`, `<<TEXT([Fecha], "DD/MM/YYYY")>>`
- Condicional: `<<If: [Total] > 1000>>Cliente VIP<<EndIf>>`
- Repetir filas relacionadas (p. ej. en una tabla del Doc, poniendo Start en la primera celda y End en la última de la fila):
```
<<Start: [Related Detalles]>> <<[Producto].[Nombre]>> | <<[Cantidad]>> | <<[Subtotal]>> <<End>>
```
- Start también acepta una lista de claves: `<<Start: SELECT(Detalles[ID], [Pedido] = [_THISROW].[ID])>>`
- Imágenes: `<<[Foto]>>` en el Doc (puedes ajustar tamaño en la plantilla).

**Marcadores en Google Docs:** escribe cada `<<…>>` en texto plano de una sola vez y aplica el formato al marcador completo. El formato parcial (negrita en parte del marcador, texto pegado con estilos) lo fragmenta internamente y el bot falla con "variable no encontrada". Arreglo: seleccionar › *Borrar formato* › reescribir. Tras renombrar columnas, revisa todos los marcadores, incluidos los que están dentro de `<<Start>>`.

**Archivos generados (PDF):** usa rutas relativas a la carpeta de la app, activa *Disable timestamp* y guarda el nombre (versionado, para evitar la caché) en una columna que lean tanto la tarea como la columna File. Detalle en `troubleshooting.md` §1.1-1.2.

Cuerpo JSON para webhook. El texto libre con `"`, saltos de línea o `\` rompe el JSON (HTTP 400): envía solo la clave, usa `<<ENCODEURL([Campo])>>` y decodifica en el receptor, o usa *Call a script* (ver `troubleshooting.md` §4.2).
```json
{
  "id": "<<[ID]>>",
  "cliente": "<<[Cliente].[Nombre]>>",
  "total": <<[Total]>>,
  "lineas": [
    <<Start: [Related Detalles]>>{"producto": "<<[Producto].[Nombre]>>", "cantidad": <<[Cantidad]>>}<<End>>
  ]
}
```
Nota: dentro de `<<Start>>` la separación con comas entre elementos JSON puede dar una coma final inválida; si da problemas, envía solo la clave y que el receptor consulte las líneas por API, o construye el texto con una expresión.

## 6. Patrones

- **Notificar al aprobar:** Event Updates en Pedidos con condición de cambio de estado → Send email al cliente con PDF adjunto.
- **Recordatorio diario:** Schedule diario 8:00, ForEachRowInTable sobre slice "Vencen pronto" → Send email al responsable.
- **Generar PDF y guardar enlace:** Create a new file (PDF) → Run a data action que guarde la ruta en la fila (o en la propia task de archivo indicar nombre/carpeta con expresión).
- **Sincronizar con otro sistema:** Event Adds/Updates → Call a webhook a n8n (ver `api-integrations.md`).
- **Actualizar padre al cambiar hijo:** Event en Detalles → Run a data action en el padre mediante acción *Execute an action on a set of rows* con referenced rows `LIST([Pedido])`.

## 7. Problemas frecuentes

- **El bot no se dispara:** ¿el cambio se hizo desde la app? ¿el bot está activado? ¿la condición exige un valor concreto en `_THISROW_BEFORE` en un evento de Adds? (al crear, los valores "antes" están vacíos) ¿la app está desplegada o en prototipo (en prototipo los emails solo llegan al creador)? Revisa *Manage › Monitor › Automation monitor / Audit history*.
- **Email no llega:** destinatario vacío o expresión que devuelve lista mal formada; revisa spam; en prototipo solo se envía al propietario.
- **Plantilla muestra `<<...>>` literal:** error de sintaxis o columna inexistente; el nombre debe coincidir exactamente.
- **Envíos repetidos:** la condición del evento *Updates* comprueba solo el estado actual; usa la transición `_THISROW_BEFORE`/`_THISROW_AFTER`.
- **PDF que no abre o sale antiguo:** ver `troubleshooting.md` §1.
- **Bucles:** un bot que actualiza la misma tabla puede volver a dispararse; añade una condición que lo evite (p. ej. solo si el campo cambió).
