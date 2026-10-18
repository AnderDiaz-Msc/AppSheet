# Diagnosing real-world issues (symptom → cause → fix)

A catalog of real issues found while building AppSheet apps. When the user describes a symptom, look it up here first, confirm the cause with specific questions or checks, and then apply the fix.

## Contents
1. PDF documents and templates
2. Data structure, schema and sync
3. Expressions and data types
4. Apps Script, webhooks and APIs
5. Access, links and field performance
6. Summary matrix

## 1. PDF documents and templates

### 1.1 Black screen or "Path not found / Bad Request" when opening a generated PDF
- **Cause:** three paths don't match: the *Folder path* of the bot's *Create a new file* task, the app's default folder (*Default app folder*, in the app settings), and the text that an action writes into the File column. It happens most with absolute Drive paths, missing subfolders, or the automatic timestamp, which appends an unpredictable suffix to the name.
- **Fix:**
  1. Use paths **relative** to the app's default folder in both places.
  2. Turn on *Disable timestamp* in the task so you control the exact name.
  3. Build the name from **a single source of truth**: first store the name in a column (e.g. `[PDFName]`) and use it both in the task's *File name prefix* and in the File column:
```
File column:   "Reports/" & [PDFName] & ".pdf"
Folder path:   "Reports"     File name prefix:  <<[PDFName]>>
```
- **Check:** open the folder in Drive and compare the actual file name with the column value, character by character.

### 1.2 After regenerating, the viewer still shows the old PDF
- **Cause:** viewer/browser/server cache; with a static name (`Report_[ID].pdf`) the cached copy is served.
- **Fix:** version the name. **Watch out:** if the name contains `NOW()` and is evaluated in two places (bot and action), the seconds won't match and you're back to issue 1.1. Compute the version **once** and store it: `[PDFName] = "Report_" & [ID] & "_" & TEXT(NOW(), "YYYYMMDD_HHMMSS")`. The bot and the File column both read that column. Alternatively, use a counter `[PDFVersion] + 1`.
- **Where to compute it (recommended):** in the **same user action that triggers the bot**, e.g. a "Close inspection" action (Data: set the values) that sets `[Status] = "Closed"` and `[PDFName]` at the same time. That way the value is already saved when the bot starts. Computing it in a *Run a data action* step inside the same bot may work, but don't promise that later steps will see the new value: if the user prefers that route, ask them to verify it in the *Automation monitor*.
- **Date format:** in `TEXT()`, `MM` means month or minutes depending on context. Use separators (`"YYYYMMDD_HHMMSS"`) and check the result with *Test*.

### 1.3 The bot fails with "variable not found / invalid expression" in a template that looks correct
- **Cause:** Google Docs internally splits a `<<[Column]>>` placeholder when part of it has different formatting (bold, color or font on only some characters, or text pasted with formatting). Orphan references also remain after renaming columns, especially inside `<<Start:…>>…<<End>>`.
- **Fix:** select the placeholder, *Format › Clear formatting*, retype it entirely as plain text, and apply styling to the whole placeholder. Audit every placeholder against the current column names. Check the exact error in *Monitor › Audit history*.

## 2. Data structure, schema and sync

### 2.1 Offline users with records stuck after changing the sheet (red sync alert)
- **Cause:** the sheet structure was changed (columns deleted, renamed or reordered) or the schema was regenerated while devices still had pending changes from an earlier version. The queued changes no longer fit the new structure.
- **Technical nuance:** AppSheet locates columns by **header name**, not only by position. The dangerous part is renaming or deleting columns and regenerating while changes are queued. Adding columns **at the end** is the safest practice and also avoids side effects on formulas and ranges in the sheet itself.
- **Prevention:** structural changes only during maintenance windows, after asking users to sync and confirming nothing is pending; new columns at the far right; never rename or delete columns on a live app.
- **Recovery:** don't clear app data or reinstall on the affected device (the queue is lost). Check *Monitor › Audit history* to see what was being written. If the change was to a renamed column, temporarily restoring the old name may let the queue through. Recovery options depend on the AppSheet version: check the current documentation.

### 2.2 New columns don't appear in the editor, views or bots
- **Cause:** AppSheet keeps a static schema definition until it is regenerated.
- **Fix:** *Data › Table › Regenerate structure* after adding columns.
- **Trap:** if you **rename** a header and regenerate, AppSheet treats it as one column deleted and a new one added, and formulas, validations, Display name, etc. are lost. Keep physical headers immutable and change the visible label with **Display name**.

### 2.3 Broken references (yellow triangle in dropdowns) or errors that disable the app
- **Cause:** the Key or Label column was changed, or its type, or the name of columns used in virtual columns, actions, format rules or slices. Child rows lose the link to their parent.
- **Fix:** a dedicated, immutable key with `UNIQUEID()`, separate from business data; Label in a different column. To change the key of a table that already has data, migrate the Refs in the child tables too.

## 3. Expressions and data types

### 3.1 Leading zeros disappear (0123 → 123), separators appear (1,234), or letters are rejected in PINs, IDs or ZIP codes
- **Cause:** a Number column (in AppSheet and/or in the cell format) for something that is an **identifier**, not a quantity. In the US the classic case is the ZIP code: `02134` becomes `2134`.
- **Fix:** Text type (or Phone for phone numbers) in AppSheet **and** "Plain text" format in the sheet; recover the lost zeros (see `sheet-normalization.md`). Validate with Valid_If:
```
AND(LEN([_THIS]) = 4, ISNOTBLANK(NUMBER([_THIS])))
```
(4-digit numeric PIN stored as text. If it must be alphanumeric, validate only the length. Use *Test* to confirm `NUMBER()` behaves as expected with leading zeros.)
- **Rule of thumb:** if you won't add it up or average it, it's not a Number.

### 3.2 "Cannot compare List with Text", or filters/Show_If coming back empty for no obvious reason
- **Cause:** `SELECT()`, `FILTER()` and `[Related …]` **always return a list** (even with 0 or 1 items), and it was compared with `=` against a single value. It also happens with curly quotes (“ ” pasted from Word, Slack or a text message) and with unbalanced parentheses in nested `IFS`/`AND`/`OR`.
- **Fix:**
```
One value:     ANY(SELECT(Table[Col], cond))     or  INDEX(SELECT(...), 1)
Membership:    IN([Value], SELECT(Table[Col], cond))
Any at all?:   ISNOTBLANK(SELECT(...))           or  COUNT(SELECT(...)) > 0
```
- **Common misconception:** `TOP(list, 1)` **still returns a list**; it doesn't give you a scalar. Use `ANY()` or `INDEX(…, 1)`.
- Replace curly quotes with straight `"` quotes and retype the expression in the editor.

### 3.3 Bots that fire on every edit, or status lights/stages that don't change
- **Cause:** the condition of an *Updates* event only checks the current state (`[Status] = "Approved"`), so any later edit to another column satisfies it again. In multi-stage flows, `Show_If`/`Editable_If`/format rules don't account for intermediate states or the user's role.
- **Fix:** detect the **transition**:
```
AND([_THISROW_BEFORE].[Status] <> [_THISROW_AFTER].[Status], [_THISROW_AFTER].[Status] = "Approved")
```
- With *Adds and Updates*, the same condition also covers rows created already "Approved": on creation, `[_THISROW_BEFORE].[Status]` is blank and therefore different from the new value. Verify with a test record.
- If a record can leave "Approved" and come back, the bot would fire again. If it should notify only once in the record's lifetime, add a Yes/No column `[Notified]` that the bot sets (Run a data action) and require it in the condition: `NOT([_THISROW_AFTER].[Notified])`.

For stages, define the complete list of states (Enum) and write conditions per state and role, e.g. `AND([Status] = "In review", <role> = "Reviewer")`. Make sure format rules use exactly the same Enum values.

## 4. Apps Script, webhooks and APIs

### 4.1 After fixing the Apps Script, AppSheet keeps running the old code
- **Cause (with *Call a webhook* to a web app `/exec` URL):** saving only updates the draft (HEAD). The `/exec` URL runs the **deployed** version, which stays frozen.
- **Fix:** *Deploy › Manage deployments › edit (pencil) › Version: New version › Deploy*. The URL stays the same.
- **Traps:** *New deployment* (instead of editing the existing one) creates **a different URL**, which you'd have to update in the webhook. The `/dev` URL runs HEAD but requires the owner's session, so AppSheet can't use it. In the deployment, "Who has access" must allow calls without a Google session (*Anyone*); otherwise the webhook gets a login page or a 401/403.
- **Check:** in Apps Script, *Executions* shows whether the call arrived and with what error; in AppSheet, the *Automation monitor*.
- **Nuance:** with the *Call a script* task (no web app URL) there is no deployment to update. If you change the function's name or parameters, re-select it in the task so AppSheet re-reads the signature, and re-authorize if new permissions are requested.

### 4.2 Webhook returns HTTP 400 or `SyntaxError: Unexpected token` in `JSON.parse(e.postData.contents)`
- **Cause:** free text containing double quotes, line breaks or backslashes, inserted as-is into the JSON template (`"notes": "<<[Notes]>>"`), breaks the syntax.
- **Common misconception:** there is no documented `:json` escape function in AppSheet templates; don't recommend it as if it existed.
- **Fixes, from most to least robust:**
  1. Send only the key (`{"id": "<<[ID]>>"}`) and have the receiver read the full row through the AppSheet API.
  2. Encode the text with `ENCODEURL()` and decode it in the receiver. `ENCODEURL` turns quotes, line breaks and backslashes into `%XX` sequences, which are safe inside a JSON string:
```
Body:    {"id": "<<[ID]>>", "notes": "<<ENCODEURL([Notes])>>"}
Script:  var notes = decodeURIComponent(String(data.notes).replace(/\+/g, ' '));
```
     (The `replace` covers spaces arriving as `+`. Test with text containing quotes, several lines, `\`, accented characters and `%`.)
  3. Use the *Call a script* task instead of a webhook: AppSheet passes each value as a function parameter, with no JSON involved.
  4. Sanitize the text with nested `SUBSTITUTE()` (double quotes → single, line breaks → space) in a virtual column. It's the most fragile option: use *Test* to check how to write the quote and line-break literals in your version.

  Also, a `try/catch` in the script fixes nothing: the body already arrives broken. Fix it at the source.
- **Diagnosis:** log the raw body at the start of `doPost`, before parsing it:
```javascript
function doPost(e) {
  var raw = e && e.postData ? e.postData.contents : '';
  SpreadsheetApp.openById(LOG_ID).getSheetByName('Log').appendRow([new Date(), raw]);
  var data = JSON.parse(raw);
  // ...
}
```

## 5. Access, links and field performance

### 5.1 Access denied, or users on an outdated version
- **Cause:** links copied from the browser during testing (from the editor or the prototype) were distributed, or the app ID changed after cloning or transferring it. When ownership is transferred, sheets and image folders in the previous creator's Drive are left without permissions for the new owner.
- **Fix:** distribute only the official links from *Users/Share › Links* (Install link / Browser link). Share sheets and folders with the owner account, with edit permission, before transferring. Check whether the app accesses data as the creator (the usual setup) or with each user's credentials: in the latter case, **every user** needs permission on the files. Confirm the exact option name in your version of the editor.

### 5.2 The app takes minutes to open, lists are slow, or sync times out in the field
- **Cause:** photos uploaded at full resolution and views that download hundreds or thousands of unfiltered historical records.
- **Fix:** lower *Image upload size* (*Settings › Views › General*) to medium or low; use **security filters** to download only active records or those assigned to the user (slices only hide rows; they don't reduce the download); archive history; turn on *Delayed sync* and background updates; check the *Performance profile*.

## 6. Summary matrix

| Category | Symptom | Cause | Fix |
|---|---|---|---|
| PDF | Black screen / path not found | Paths out of sync between bot, app folder and File column | Relative paths, *Disable timestamp*, name stored in a column |
| PDF | Old version shown | Cache because of a static name | Versioned name computed **only once** |
| Templates | Variables not found | Partial formatting splits `<<…>>`; renamed columns | Clear formatting, retype the placeholder, audit names |
| Schema | Offline sync blocked | Structure changed with changes queued | Maintenance windows, columns at the end, never rename on a live app |
| Schema | New columns invisible / configuration lost | Static schema; renaming = new column | Regenerate structure; Display name instead of renaming |
| Types | Lost zeros, letters rejected | Number used for identifiers | Text/Phone + plain-text format in the sheet |
| Expressions | Cannot compare List with Text | Comparing a list with `=` | `ANY`, `INDEX(…,1)`, `IN`, `ISNOTBLANK` (not `TOP`) |
| Bots | Repeated firing | Condition without a transition | `_THISROW_BEFORE <> _THISROW_AFTER` + target state |
| Apps Script | Old code runs | Web app without a new deployed version | Manage deployments › New version |
| Webhook | HTTP 400 / invalid JSON | Unescaped free text | Send only the key, `ENCODEURL` + `decodeURIComponent`, or *Call a script*; log the raw body |
| Access | Access denied / old version | Test links; Drive permissions after transfer | Official links; share folders with the owner |
| Performance | Slow / timeouts | Heavy photos, unfiltered data | Image upload size, security filters, Delayed sync |
