# API and integrations

## Contents
1. AppSheet API v2
2. Calling external services from AppSheet (webhooks)
3. Google Apps Script
4. n8n
5. Security

## 1. AppSheet API v2

**Enable it:** *Settings › Integrations › IN: from cloud services to your app* → turn on the API and create an **Application Access Key**. Note the **App ID** (same screen).

**Endpoint:**
```
POST https://api.appsheet.com/api/v2/apps/{appId}/tables/{tableName}/Action
```
(For apps in other regions it may be `https://www.appsheet.com/...` or a regional domain; if you get 404/403, check the URL shown in the editor itself.)

**Headers:**
```
ApplicationAccessKey: <key>
Content-Type: application/json
```
(`?applicationAccessKey=<key>` in the URL is also accepted, but the header is preferable so the key doesn't end up in logs.)

**Body:**
```json
{
  "Action": "Add",
  "Properties": {
    "Locale": "en-US",
    "Timezone": "America/New_York",
    "RunAsUserEmail": "user@domain.com"
  },
  "Rows": [
    { "ID": "abc123", "Customer": "c-001", "Status": "Pending" }
  ]
}
```

| Action | Rows |
|---|---|
| `Add` | New rows (include the key or let the Initial value generate it). |
| `Edit` | Rows with the key + columns to change. |
| `Delete` | Rows with only the key. |
| `Find` | Empty `[]` for all rows, or use `Properties.Selector`. |
| `"<Action name>"` | Runs an app action on the rows given by key. |

**Filtering in Find:**
```json
"Properties": { "Selector": "Filter(Orders, [Status] = \"Pending\")" }
```
Also: `"Select(Orders[ID], [Total] > 100, true)"`, `"OrderBy(Filter(...), [Date], true)"`, `"Top(OrderBy(...), 10)"`.

Notes:
- `Locale` affects the date/number format you send and receive; be consistent (`en-US` = MM/DD/YYYY and `1,053.50`).
- `RunAsUserEmail` makes `USEREMAIL()` and security filters evaluate as that user.
- Changes made through the API **do** trigger bots.
- API access may depend on the AppSheet plan; check availability on the user's account.

curl example:
```bash
curl -X POST "https://api.appsheet.com/api/v2/apps/$APP_ID/tables/Orders/Action" \
  -H "ApplicationAccessKey: $APPSHEET_KEY" -H "Content-Type: application/json" \
  -d '{"Action":"Find","Properties":{"Locale":"en-US"},"Rows":[]}'
```

## 2. Webhooks from AppSheet

*Call a webhook* task in a bot:
- URL (can contain `<<[ID]>>` expressions), HTTP method, headers (e.g. a token), JSON body from a template (see `automation.md` §5).
- Turn on *Return value* if you want to use the response in later steps.
- To call another app's AppSheet API, the task has an "AppSheet API" preset.

## 3. Google Apps Script

*Call a script* task:
1. Create an Apps Script project with a function, e.g.:
```javascript
function createEvent(title, start, end, email) {
  const ev = CalendarApp.getDefaultCalendar().createEvent(title, new Date(start), new Date(end), {guests: email});
  return ev.getId();
}
```
2. In the task, pick the project and the function; map each parameter with an expression (`[Title]`, `[Start]`…).
3. If the function returns a value, turn on *Return value* and use it later as `[StepName].[Output]` (e.g. to store the event ID in the row with an action).
4. The first time, the script's permissions must be authorized.

**Apps Script web app as a webhook receiver** (`doPost(e)` at a `.../exec` URL):
- After every code change: *Deploy › Manage deployments › edit › New version › Deploy*. Saving isn't enough: `/exec` keeps running the previously deployed version. The URL stays the same.
- Log `e.postData.contents` to a log sheet before `JSON.parse`, to see what actually arrived (see `troubleshooting.md` §4).
- With *Call a script* there is no deployment: if you change the function's name or parameters, re-select it in the task.

For a script to **write to AppSheet and trigger bots**, have it call the AppSheet API with `UrlFetchApp.fetch` instead of writing to the sheet.

## 4. n8n

If they are installed, also use the n8n skills (`n8n-workflow-patterns`, `n8n-node-configuration`, `n8n-expression-syntax`) to build the workflow.

**AppSheet → n8n:** a *Webhook* node in n8n (POST method, copy the production URL) → in AppSheet, a *Call a webhook* task to that URL with a JSON body. In n8n the data arrives in `{{ $json.body.<field> }}`. Protect the webhook with a secret header (Header Auth).

**n8n → AppSheet:** *HTTP Request* node:
- Method POST, URL `https://api.appsheet.com/api/v2/apps/<APP_ID>/tables/<Table>/Action`
- Header `ApplicationAccessKey` (store it as a *Header Auth* credential, not in plain text)
- JSON body with `Action`, `Properties`, `Rows` as above.
- The `Find` response is an array of rows (sometimes wrapped); inspect the output before mapping it.

## 5. Security

- Don't paste Access Keys into visible templates, app columns or shared code; use script properties (`PropertiesService`) or n8n credentials.
- Regenerate the key if it's exposed.
- Validate in the receiver that the webhook comes from AppSheet (secret token in a header).
