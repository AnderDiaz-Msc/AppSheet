# Data model, UX and security

## Contents
1. Preparing the data source
2. Tables, keys and references
3. Virtual vs. physical columns
4. Slices
5. Views
6. Actions
7. Roles and security
8. Performance
9. App design template

## 1. Preparing the data source (Google Sheets / Excel)

- One tab = one table. Headers in row 1, no merged cells, no blank rows in between, no totals at the bottom.
- Unique, stable column names (renaming later breaks expressions).
- Avoid sheet formulas in rows the app writes to; prefer App formulas. Sheet formulas only show up after a sync.
- Sheet locale consistent with the app's (dates and decimals).
- An `ID` column as the first column, for the key.
- IDs, PINs, codes, ZIP codes and phone numbers formatted as "Plain text".
- Clean, normalized data before building the app (see `sheet-normalization.md`).

**Structural changes while the app is in use** (see `troubleshooting.md` §2):
- Immutable headers: to change what the user sees, use *Display name*. Renaming and regenerating = a new column, and its configuration is lost.
- New columns at the **end** of the sheet, then *Regenerate structure*.
- Structural changes only during maintenance windows, when no device has changes waiting to sync.

## 2. Tables, keys and references

- **Normalize:** one table per entity (Customers, Products, Orders, OrderLines). Repeated data goes into its own table and is referenced.
- **Key:** an `ID` column, Text type, Initial value `UNIQUEID()`, hidden. Never `_RowNumber` (it changes when rows are deleted) or editable business data.
- **Label:** mark as *Label* the column the user recognizes (Name), so Refs display properly.
- **Ref:** the child column stores the parent's key (`Orders[Customer]` Ref → `Customers`). AppSheet automatically creates the virtual column `Related Orders` = `REF_ROWS("Orders", "Customer")` in the parent.
- **Is a part of:** turn this on in the child table's Ref (OrderLines → Orders) to add lines inside the parent's form and delete in cascade.
- **Many-to-many:** a junction table with two Refs (e.g. `Assignments` with `Employee` and `Project`), or an EnumList of Refs if the relationship is simple and small.
- **Types matter:** Email, Phone, Price, Percent, Image, File, LatLong, Address, Signature, Enum, EnumList, Yes/No, Ref, Duration… The type changes the keyboard, formatting and validation.

## 3. Virtual vs. physical columns

| Use a virtual column when… | Use a physical column (+ App formula or action) when… |
|---|---|
| The value derives from the row or direct Refs and is cheap | You need the value in the sheet (reports, other tools) |
| It's display-only | The computation is expensive (SELECT over large tables) |
| | The value must be "frozen" at a point in time (price at time of sale) |

To "freeze" a price: physical column `UnitPrice` with Initial value `[Product].[Price]` (not an App formula, which would recalculate).

## 4. Slices

Filtered subsets of a table (rows, columns and allowed actions). Use them for views by status (Pending, Approved), "My records" (`[Owner] = USEREMAIL()`) and to limit the columns of a view. **They are not security:** the full data is still on the device; to hide data, use security filters.

## 5. Views

- Types: Deck, Table, Gallery, Detail, Form, Card, Map, Calendar, Chart, Dashboard, Onboarding.
- Position: *primary* (bottom bar, ~5 max), *menu*, *ref* (internal navigation only).
- Group by and Sort by in the view; use a Dashboard to combine views.
- Format rules for colors/icons by condition (e.g. `[Status] = "Overdue"` in red).
- The view's Show_If to hide it by role.

## 6. Actions

- **App:** go to another view/row/form (`LINKTOROW`, `LINKTOFORM`…), copy row, edit, delete.
- **Data:** *Set the values of some columns in this row*; *Add a new row to another table using values from this row*; *Execute an action on a set of rows* (referenced rows = list of keys); *Delete*.
- **External:** call, SMS, email, open URL.
- **Grouped:** runs several actions in sequence.
- Configure position (Prominent/Inline/Overlay/Hidden), the "Only if this condition is true" condition and confirmation.
- "Approve" pattern: Data action `Status = "Approved"`, `ApprovedAt = NOW()`, `ApprovedBy = USEREMAIL()`, visible only if `AND([Status] = "Pending", <is approver>)`.

## 7. Roles and security

- Require sign-in (Security › Require user signin) and a user list/domain.
- A `Users` table (Email as key, Name, Role). Get the role with `LOOKUP(USEREMAIL(), "Users", "Email", "Role")` or with a slice/virtual column in a `Me` table.
- **Security filter** (Security › Security filters): e.g. `OR([Owner] = USEREMAIL(), LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin")`. It's the only way to keep rows from reaching a user.
- On the `Users` table itself, avoid a security filter that `LOOKUP`s into `Users` (it's circular: the filter needs the table it is filtering). Use `[Email] = USEREMAIL()`, and keep admin lists in a separate table if admins must see every row. Verify the behavior with *Preview app as*.
- Table permissions: Are updates allowed? can be an expression: `IF(LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin", "ALL_CHANGES", "ADDS_ONLY")`.

## 8. Performance

- Reduce virtual columns with SELECT/FILTER/LOOKUP; prefer Refs and dereferences.
- Use security filters to avoid downloading unnecessary data (with SQL/AppSheet Database they are applied server-side).
- Archive historical data in another table/sheet.
- Turn on *Delayed sync* and *Sync on start* as appropriate; check the *Performance profile* to see which expressions are costly.
- Images: store them as files (folder), not base64, and lower *Image upload size* (*Settings › Views › General*) to medium or low for field work.
- Distribute only the official links (*Users/Share › Links*), never URLs copied from the editor or the prototype.

## 9. App design template

When proposing a complete app, deliver:

1. **Tables** (one markdown table per table: Column | Type | Key/Label | Formula/Initial value | Notes).
2. **Relationships** (which Ref points to what, which are *Is a part of*).
3. **Slices** with their filter.
4. **Views** (name, type, source, position, grouping).
5. **Actions** with their condition.
6. **Security** (roles, security filters, table permissions).
7. **Automations** if applicable (see `automation.md`).
8. **Test steps.**
