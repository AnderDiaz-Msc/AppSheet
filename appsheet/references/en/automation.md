# Automations (Bots)

## Contents
1. Structure: Bot → Event → Process → Steps → Tasks
2. Events
3. Process steps
4. Tasks
5. Templates (email, PDF, documents)
6. Patterns
7. Common problems

## 1. Structure

In *Automation*:
- **Bot**: links an event to a process. It can be turned on/off.
- **Event**: what triggers it (data change or schedule).
- **Process**: a sequence of **steps**.
- **Step**: run a task, branch on a condition, wait, call another process, return values.
- **Task**: the concrete action (email, notification, webhook, script, file, data action).

## 2. Events

**Data change:** table + type (Adds, Updates, Deletes, or a combination) + optional condition (Yes/No). The condition can use `[_THISROW_BEFORE]` and `[_THISROW_AFTER]`.

Example — only when the status changes to "Approved":
```
AND([_THISROW_BEFORE].[Status] <> "Approved", [_THISROW_AFTER].[Status] = "Approved")
```

**Schedule:** daily, weekly, monthly, etc., with a time and time zone. It can run **ForEachRowInTable** over a table/slice with a filter condition, to process every matching row (e.g. due-date reminders):
```
AND([Status] <> "Paid", [DueDate] = TODAY() + 3)
```

**What triggers a Data change event:** changes made from the app, through the AppSheet API, and by actions/other bots. Edits made directly in Google Sheets/Excel, or scripts that write to the sheet, do **not** trigger it. If the user needs that, the options are: write through the AppSheet API from Apps Script, or use a scheduled bot that checks rows.

## 3. Process steps

- **Run a task**: runs a task.
- **Branch on a condition**: yes/no with an expression on the row.
- **Wait**: waits for a time or until a condition.
- **Call a process**: reuses another process (it can run on another table, e.g. on related rows).
- **Return values**: returns values to the calling process.

Results from earlier tasks (e.g. from *Call a script* or *Call a webhook* with "Return value") are used later as `[StepName].[Output]` (or the name of the returned field).

## 4. Tasks

| Task | Use |
|---|---|
| Send an email | Recipients via expression (`[Customer].[Email]`, `LIST(...)`), subject, body, attachments (PDF generated from a template). |
| Send a notification | Push to app users (they need the app installed and notifications enabled). |
| Send an SMS | |
| Call a webhook | HTTP to an external service (n8n, Make, Zapier, your own API). JSON body from a template. |
| Create a new file | Generates PDF/CSV/HTML/XLSX/JSON from a template and saves it to a folder. |
| Call a script | Runs a Google Apps Script function with parameters; can return a value. |
| Run a data action | Runs an app action (set values, add row…) on the row. |

## 5. Templates

Templates (Google Docs for email/PDF, or text/JSON in the editor) use `<<…>>` placeholders:

- Value: `<<[CustomerName]>>`, `<<[Customer].[Email]>>`, `<<TEXT([Date], "MM/DD/YYYY")>>`
- Conditional: `<<If: [Total] > 1000>>VIP customer<<EndIf>>`
- Repeat related rows (e.g. in a Doc table, with Start in the first cell and End in the last cell of the row):
```
<<Start: [Related OrderLines]>> <<[Product].[Name]>> | <<[Quantity]>> | <<[Subtotal]>> <<End>>
```
- Start also accepts a list of keys: `<<Start: SELECT(OrderLines[ID], [Order] = [_THISROW].[ID])>>`
- Images: `<<[Photo]>>` in the Doc (you can adjust the size in the template).

**Placeholders in Google Docs:** type each `<<…>>` as plain text in one go and apply formatting to the whole placeholder. Partial formatting (bold on part of the placeholder, text pasted with styles) splits it internally and the bot fails with "variable not found". Fix: select › *Clear formatting* › retype. After renaming columns, check every placeholder, including those inside `<<Start>>`.

**Generated files (PDF):** use paths relative to the app folder, turn on *Disable timestamp*, and store the (versioned, to avoid caching) name in a column that both the task and the File column read. Details in `troubleshooting.md` §1.1-1.2.

JSON body for a webhook. Free text containing `"`, line breaks or `\` breaks the JSON (HTTP 400): send only the key, use `<<ENCODEURL([Field])>>` and decode in the receiver, or use *Call a script* (see `troubleshooting.md` §4.2).
```json
{
  "id": "<<[ID]>>",
  "customer": "<<[Customer].[Name]>>",
  "total": <<[Total]>>,
  "lines": [
    <<Start: [Related OrderLines]>>{"product": "<<[Product].[Name]>>", "quantity": <<[Quantity]>>}<<End>>
  ]
}
```
Note: inside `<<Start>>`, comma separation between JSON items can produce an invalid trailing comma; if it causes trouble, send only the key and let the receiver fetch the lines through the API, or build the text with an expression.

## 6. Patterns

- **Notify on approval:** Updates event on Orders with a status-transition condition → Send email to the customer with the PDF attached.
- **Daily reminder:** daily Schedule at 8:00, ForEachRowInTable over a "Due soon" slice → Send email to the owner.
- **Generate a PDF and store the link:** Create a new file (PDF) → Run a data action that stores the path in the row (or set name/folder with an expression in the file task itself).
- **Sync with another system:** Adds/Updates event → Call a webhook to n8n (see `api-integrations.md`).
- **Update the parent when a child changes:** event on OrderLines → Run a data action on the parent through an *Execute an action on a set of rows* action with referenced rows `LIST([Order])`.

## 7. Common problems

- **The bot doesn't fire:** was the change made from the app? Is the bot turned on? Does the condition require a specific value in `_THISROW_BEFORE` on an Adds event? (on creation, the "before" values are blank) Is the app deployed or still a prototype (in prototype, emails only reach the creator)? Check *Manage › Monitor › Automation monitor / Audit history*.
- **Email doesn't arrive:** blank recipient or an expression returning a malformed list; check spam; in prototype it's only sent to the owner.
- **Template shows `<<...>>` literally:** syntax error or nonexistent column; the name must match exactly.
- **Repeated sends:** the *Updates* event condition only checks the current state; use the `_THISROW_BEFORE`/`_THISROW_AFTER` transition.
- **PDF won't open or shows an old version:** see `troubleshooting.md` §1.
- **Loops:** a bot that updates the same table can trigger itself again; add a condition that prevents it (e.g. only if the field changed).
