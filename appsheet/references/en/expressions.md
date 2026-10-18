# AppSheet expressions

## Contents
1. Basic syntax
2. Where expressions are used (and what they must return)
3. Functions by category
4. Common patterns
5. Common traps
6. How to debug

## 1. Basic syntax

- Column of the current row: `[Quantity]`
- Column of a referenced row (dereference): `[Customer].[Email]` — only works if `Customer` is a Ref column.
- List of a column's values across the whole table: `Products[Name]`
- List dereference: `[Related OrderLines][Subtotal]` → list of subtotals of the child rows.
- Current row inside a `SELECT`/`FILTER`: `[_THISROW].[Column]` (inside the filter, `[Column]` refers to the row of the other table being evaluated).
- In bots/data-change conditions: `[_THISROW_BEFORE].[Status]` and `[_THISROW_AFTER].[Status]`.
- Literals: text `"abc"`, number `5`, decimal `5.0`, date `"2026-01-31"` or `DATE("01/31/2026")`, duration `"001:30:00"`, boolean `TRUE`/`FALSE`, list `LIST(1,2)` or `{1, 2}`.
- Operators: `+ - * / = <> < > <= >=`, `&` (text concatenation), `AND()`, `OR()`, `NOT()`.

## 2. Where they are used and what they must return

| Field | Returns | Notes |
|---|---|---|
| App formula | value of the column's type | Recalculated when the row is saved (and on sync if virtual). The column becomes read-only. |
| Initial value | value of the type | Only when the row is created; the user can change it. |
| Valid_If | Yes/No **or** list | If it returns a list, it becomes a dropdown with those options. |
| Show_If | Yes/No | Hides the column in forms/detail views. Not security. |
| Editable_If | Yes/No | |
| Required_If | Yes/No | |
| Slice row filter | Yes/No | Evaluated per row. |
| Security filter | Yes/No | Filters which rows are downloaded to the device (real security). |
| Format rule | Yes/No | |
| Action "Only if this condition is true" | Yes/No | |
| Bot condition (data change) | Yes/No | Can use `_THISROW_BEFORE/AFTER`. |
| Referenced rows (action on a set of rows) | list of keys | Typically `SELECT(Table[Key], …)` or `[Related X]`. |

## 3. Functions by category

**Conditionals:** `IF(cond, yes, no)`, `IFS(c1, v1, c2, v2, …)` (no "else"; use `TRUE, value` at the end), `SWITCH(expr, v1, r1, v2, r2, …, default)`.

**Blanks:** `ISBLANK(x)`, `ISNOTBLANK(x)`.

**Lookups and lists from other tables:**
- `LOOKUP(value, "Table", "SearchCol", "ReturnCol")` → one value.
- `SELECT(Table[Col], condition, [distinct?])` → list.
- `FILTER("Table", condition)` → list of keys (same as `SELECT(Table[Key], …)`).
- `REF_ROWS("ChildTable", "RefColToParent")` → list of child rows (AppSheet generates it as `Related …`).
- `MAXROW("Table", "Col", [condition])` / `MINROW(...)` → key of the row with the max/min value.
- `ANY(list)` → one item; `INDEX(list, n)` → nth item (1-based).

**Lists:** `COUNT`, `SUM`, `AVERAGE`, `MAX`, `MIN`, `IN(value, list)`, `ISNOTBLANK(list)`, `UNIQUE(list)`, `SORT(list, [desc?])`, `TOP(list, n)`, `LIST(...)`, `SPLIT(text, ",")`, union `list1 + list2`, difference `list1 - list2`, `INTERSECT(l1, l2)`.

**Text:** `CONCATENATE(...)` or `&`, `TEXT(value, "MM/DD/YYYY")`, `LEFT`, `RIGHT`, `MID`, `LEN`, `FIND`, `SUBSTITUTE`, `UPPER`, `LOWER`, `TRIM`, `CONTAINS(text, sub)`, `STARTSWITH`, `ENDSWITH`, `NUMBER(text)`, `UNIQUEID()`, `HYPERLINK(url, text)`, `ENCODEURL(text)`.

**Dates and times:** `TODAY()`, `NOW()`, `UTCNOW()`, `DATE(x)`, `TIME(x)`, `YEAR`, `MONTH`, `DAY`, `WEEKDAY` (1=Sunday), `WEEKNUM`, `EOMONTH(date, months)`, `EWOMONTH`, `HOUR(duration)`, `MINUTE`, `TOTALHOURS(duration)`, `TOTALMINUTES`, `WORKDAY(date, days, [holidays])`, `NETWORKDAYS(start, end, [holidays])`. Date − date = Duration; date + number = date (+ days).

**User and context:** `USEREMAIL()`, `USERNAME()`, `USERSETTINGS("Name")`, `CONTEXT("View")`, `CONTEXT("ViewType")`, `CONTEXT("Host")` (`"Browser"`/`"Device"`/`"Server"`), `CONTEXT("Device")`.

**Navigation (App actions / URL columns):** `LINKTOVIEW("View")`, `LINKTOROW([Key], "View")`, `LINKTOFORM("Form", "Col", value, …)`, `LINKTOFILTEREDVIEW("View", condition)`, `LINKURL(...)`.

**Math:** `ROUND(x, [dec])`, `FLOOR`, `CEILING`, `MOD`, `ABS`, `DECIMAL(x)`, `RANDBETWEEN`.

## 4. Common patterns

Order total from its lines (in `Orders`, virtual column, Decimal):
```
SUM([Related OrderLines][Subtotal])
```

Dependent dropdown (Valid_If of `OrderLines[Product]`, only products in the chosen category):
```
SELECT(Products[ID], [Category] = [_THISROW].[Category])
```

Prevent duplicates (Valid_If of `Customers[Email]`):
```
NOT(IN([_THIS], SELECT(Customers[Email], [ID] <> [_THISROW].[ID])))
```

Current user's role (with a `Users` table with columns Email, Role):
```
LOOKUP(USEREMAIL(), "Users", "Email", "Role")
```
Show_If for admins only:
```
LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin"
```

A customer's latest record (key):
```
MAXROW("Visits", "Date", [Customer] = [_THISROW].[ID])
```

Readable sequential number (careful: not safe with concurrent or offline users; use it as a label, not as a key):
```
"ORD-" & TEXT(COUNT(Orders[ID]) + 1)
```

Detect a status change in a bot:
```
AND([_THISROW_BEFORE].[Status] <> [_THISROW_AFTER].[Status], [_THISROW_AFTER].[Status] = "Approved")
```

Age or tenure in days:
```
HOUR(TODAY() - [StartDate]) / 24
```

## 5. Common traps

- **Integer division:** if both operands are Number, `5/2 = 2`. Use `DECIMAL([A]) / [B]` or `[A] * 1.0 / [B]`.
- **Comparing with blank:** `[Col] = ""` gives unexpected results (with a blank left side it can return TRUE). Use `ISBLANK`.
- **Forgotten `[_THISROW]`:** inside `SELECT`, `[Category] = [Category]` compares the row with itself and is always TRUE.
- **List vs. single value ("Cannot compare List with Text"):** `SELECT`, `FILTER` and `[Related …]` always return a list. Use `ANY()`/`INDEX(…,1)` for one value, `IN()` for membership and `ISNOTBLANK()` for "is there any". `TOP(list, 1)` is still a list.
- **Curly quotes** (“ ”) pasted from Word, Slack or a text message break the expression; always use straight `"`.
- **Identifiers typed as Number:** they lose zeros (`0123` → `123`, ZIP `02134` → `2134`) and reject letters. Use Text (see `troubleshooting.md` §3.1).
- **Types in comparisons:** comparing a Ref (key) with a display name won't match; compare key with key.
- **EnumList:** it's a list; use `IN("value", [MyEnumList])`, not `=`.
- **`CONTAINS` is for text**, not lists (for lists, `IN`).
- **`TEXT()` on dates** depends on the table's locale; for fixed formats, give the pattern explicitly.
- **Dates in Sheets:** if the sheet's locale differs from the app's, day and month can be swapped. Check the sheet's locale and the table's (Data › Table settings › Locale). US data uses MM/DD/YYYY.
- **Performance:** every virtual column with `SELECT`/`FILTER`/`LOOKUP` is evaluated per row on every sync: N rows × M rows. Replace them with Ref + `REF_ROWS`, physical columns computed by an action/bot, or slices.

## 6. How to debug

1. Open the expression editor and press **Test** to see the result on real rows.
2. Split the expression: create temporary virtual columns for each part.
3. Check column types (a Text column holding numbers won't sum).
4. Check *Manage › Monitor › Performance profile* / *Audit history* for sync or bot problems.
