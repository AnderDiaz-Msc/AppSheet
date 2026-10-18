# Normalizing a spreadsheet as a database for AppSheet

## Contents
1. Why it matters
2. Workflow
3. Sheet diagnosis
4. Rules by data type
5. Hierarchical geographic data (5.1 United States, 5.2 Latin America)
6. Restructuring into tables (relational model)
7. Bundled tools
8. Deliverable to the user

## 1. Why it matters

AppSheet treats the sheet as a database. "Dirty" data causes visible errors in the app: Refs break because "Los Angeles" ≠ "Los Angeles County" ≠ "LA County", totals come out wrong because "1.053" is read as 1.053 instead of 1053, zeros are lost in ZIP codes, IDs or PINs typed as Number, and filters fail because of extra spaces. Normalizing before building (or before a migration) prevents most of the issues in `troubleshooting.md` §2-3.

## 2. Workflow

1. **Backup.** Duplicate the file or work in a new tab. Never normalize the live data an app in production is using.
2. **Diagnosis** (§3): inventory of columns, the real type of each one, and the problems found, with examples.
3. **Proposed rules** per column (§4-5). Show them to the user and confirm before applying, especially how numbers and dates will be interpreted: it's ambiguous, and a silent mistake corrupts data. If you can't ask (e.g. you were asked for the finished file), apply the interpretation with the most evidence and write it down as an **assumption** at the top of the report.
4. **Apply** with the script (§7) or with formulas. The result goes to a new tab and produces a change report.
5. **Human review** of what is flagged "review" (approximate matches, ambiguous values, not found). Don't guess: a wrongly assigned county is worse than an empty, flagged one. And don't destroy data either: never blank out or delete a doubtful value (an impossible date, a ZIP from the wrong state, a duplicate row). Keep it as it was, or with the proposed fix, and flag it; the person reviewing needs the original to decide.
6. **Restructure** into tables if needed (§6).
7. **Replace and regenerate:** during a window with no users holding pending changes, replace the data, verify that headers weren't renamed (or plan the change, see `troubleshooting.md` §2), and run *Regenerate structure* in AppSheet.

## 3. Diagnosis

For each column, report:
- Proposed AppSheet type (Text, Number, Decimal, Price, Date, Email, Phone, Enum, Ref…).
- % blank and number of distinct values. Few distinct values suggest an Enum or a lookup table.
- Problems, with 2-3 real examples: double or trailing spaces, inconsistent capitalization, variants of the same value, mixed thousands/decimal separators, dates in several formats, merged cells, totals or blank rows in between, several things in one cell ("Austin, TX 78701"), duplicate headers or headers with line breaks.
- Candidate key column (unique, no blanks). If there isn't one, propose adding `ID` with `UNIQUEID()`.

If you have access to the file (CSV/XLSX), analyze it yourself (with Node, or with the `xlsx` skill for Excel). Otherwise, ask the user for a sample of ~20 rows with headers.

## 4. Rules by data type

| Type | Rule | Example |
|---|---|---|
| Proper names (people, places) | Clean spaces, capitalize each word; particles (van, von, de…) lowercase except at the start; Mc/O' prefixes; suffixes Jr./Sr./III; initials with periods in uppercase; keep accents | `mary-kate MCDONALD` → `Mary-Kate McDonald`; `patrick o'brien jr.` → `Patrick O'Brien Jr.` |
| Numbers (quantities, amounts) | Remove currency symbols, spaces and the thousands separator; keep the plain number. Decide the decimal separator **per column** with evidence | `$1,053.50` → `1053.5`; `2,400` → `2400`; `(300.25)` → `-300.25` |
| Identifiers, IDs, PINs, codes, ZIP codes, FIPS codes | **Text** with leading zeros; cell format "Plain text". Numeric ones lose periods, dashes and spaces; alphanumeric ones (`A-001`) are **left untouched**: changing a key breaks references from other tables | `02134` stays `02134`; `2134` with length 5 → `02134`; `A-001` stays `A-001` |
| Phone numbers | Text, digits only plus a leading `+` (Phone type in AppSheet) | `(555) 123-4567` → `5551234567`; `+1 555 123 4567` → `+15551234567` |
| Email | Lowercase, no spaces, validate format | |
| Dates | One interpretation per column (MDY in the US); real date-formatted cells, not text; flag invalid ones | `03/05/2024` = March 5 |
| Categories (status, type) | Closed list of values → Enum or lookup table; merge variants | `active`, `Active `, `ACTIVE` → `Active` |
| Free text (notes) | Only clean spaces; don't change capitalization | |

**Numeric ambiguity (the most important rule):** `1,053` is one thousand fifty-three in en-US, but 1.053 in many Latin American and European locales, and `1.053` is the reverse. Decide per column with evidence:
- Values like `2,400,000` or `1,053.5` → the comma is the thousands separator.
- Values like `12,5` or `1.053,5` → the comma is the decimal separator.
- If the column holds whole quantities (units, headcount, dollar amounts without cents), `1,053` is almost certainly 1053.
- If there isn't enough evidence, ask.

Also watch for numbers that were already corrupted on import: once Sheets has turned a value into the wrong number, the original text is gone. Signal: values with exactly 3 decimals in a column of whole numbers. Flag them for review; don't "fix" them blindly.

Locale: check the sheet's *File › Settings › Locale* and the table's *Locale* in AppSheet. They must match how the data is written.

## 5. Hierarchical geographic data

Typical hierarchies: United States: State › County › City/Town. Colombia: Departamento › Municipio › Corregimiento › Vereda. Mexico/Venezuela: Estado › Municipio › Parroquia/Localidad. Normalize them like this:

1. **Split** cells that mix levels (`Austin, TX` → two columns; `Austin, TX 78701` → three).
2. **Official catalog** for the levels that have one (see §5.1 and §5.2). Import it into tabs such as `Cat_States` and `Cat_Counties` (Code | Name | Parent | Alias). Aliases capture common names and abbreviations.
3. **Match top-down:** the upper level first, then the lower one **within its parent**. Names repeat across parents ("Washington County" exists in about thirty states; Rionegro exists in two Colombian departments), so matching a county without its state gives ambiguous results.
4. **Tolerant comparison:** ignore accents, case, punctuation, prefixes ("County of", "Municipio de", "Vereda") and US suffixes ("County", "Parish", "Borough"). Approximate matches (`san deigo` → `San Diego County`) are proposed but flagged for review.
5. **Store the code**, not just the name: add `State_Code`, `County_Code` (text, with zeros) at the end of the table. The code is stable and serves as the key for Refs.
6. **Levels without an official catalog** (cities by postal name, neighborhoods, veredas): cluster spelling variants **within the same parent**, propose the most frequent form as canonical, and let the user confirm. Build your own lookup table from the result (`Cities`: ID, Name, County_Code).

**In AppSheet** (see `data-modeling.md`): tables `States` (key Code), `Counties` (key Code, Ref to States) and `Cities` (Ref to Counties). In the records table, use Ref columns with dependent dropdowns:
```
Valid_If of [County]:  SELECT(Counties[Code], [State] = [_THISROW].[State])
Valid_If of [City]:    SELECT(Cities[ID], [County] = [_THISROW].[County])
```
Mark `Name` as the Label in each catalog so the user sees names and the app stores codes.

### 5.1 United States data

- **Numbers:** comma for thousands, period for decimals (`$1,053.50` → `1053.5`).
- **Dates:** MM/DD/YYYY (`03/05/2024` = March 5).
- **Geography:** official catalog = Census Bureau **FIPS** codes (2-digit state, 5-digit county: `06037` = Los Angeles County, California). Useful aliases: postal abbreviations (`CA`, `NY`, `TX`). Louisiana has parishes and Alaska boroughs/census areas instead of counties. Don't strip "City" from names: it's part of the name (Carson City, Jersey City).
- **Cities:** the Census publishes a catalog of *places* (7-digit code: state + place), but the postal city in an address isn't always an official place, and some places span several counties (if you use that catalog, its parent is the state, not the county). If you don't use it, cluster variants within each county.
- **ZIP codes:** 5-digit text. The classic lost-zero case: `02134` (Boston) becomes `2134` when opened in Excel/Sheets. `{"type": "id", "length": 5, "lengths": [5, 5], "unique": false, "zipState": "State"}` restores the zeros, flags anything that isn't 5 digits, and flags ZIPs whose first digit doesn't match the row's state (e.g. a Boston `02134` in a California row). Put that config entry **after** the State geo column. Padding a zero can be wrong if the original was simply mistyped, which is exactly what the state check catches. For ZIP+4 (`02134-1234`) use type `text`.
- **Names:** `McDonald`, `O'Brien`, `Jr.`, `III`; particles like `van`, `von`, `de` lowercase except at the start. Names like `DeShawn` or `MacArthur` can't be inferred reliably; review them.
- **Phone numbers:** 10 digits; `+1` optional but consistent.
- **Sensitive identifiers (SSN):** if they appear, recommend not storing them in the app, or restricting them with security filters.

### 5.2 Latin American data

- **Numbers:** period for thousands, comma for decimals (`1.053` → `1053`; `1.053,75` → `1053.75`).
- **Dates:** DD/MM/YYYY.
- **Geography:** Colombia uses DANE's **DIVIPOLA** (2-digit departments, 5-digit municipalities; available at datos.gov.co); Mexico uses INEGI's catalog. Aliases: `Bogota`, `Distrito Capital`, `Santiago de Cali`. Veredas and corregimientos usually lack a complete official catalog: cluster within each municipality.
- **Names:** particles `de`, `del`, `la`, `y` lowercase; keep accents and ñ (`jUAN DE la torre` → `Juan de la Torre`).
- **National IDs (cédula, NIT):** numeric text without periods (`1.053.456` → `1053456`); for Colombian cédulas, `"lengths": [6, 10]`.

## 6. Restructuring into tables

If the sheet is one big flat table (each row mixes customer, product, location and transaction):
- Extract each repeated entity into its own tab with a key (`Customers`, `Products`, `Locations`).
- Replace the repeated data in the main table with the key (Ref column).
- Repeated columns (`Product1`, `Product2`, `Product3`) → a child table with one row per item (*Is a part of*).
- A cell with several comma-separated values → a child table, or an EnumList if there are few values from a closed list.

## 7. Bundled tools

- `scripts/normalizacion-core.js`: pure functions (proper names, numbers, IDs, phone numbers, dates, geographic matching against a catalog, variant clustering, and `normalizarTabla`/`normalizeTable` for a whole table). Works in Node and Apps Script. Besides normalizing, it **flags for review** out-of-scale numbers (≥100× off the median), numbers Sheets already corrupted, and IDs that are duplicated, of unusual length, or with an unusual leading zero. If you know the valid range, pass it: `{"type": "id", "lengths": [5, 5], "unique": false}`.
- **Language:** pass `{language: 'en'}` (or `"language": "en"` in `config.json`) to get English report messages, `_Code` columns and, by default, MDY dates and a period as the decimal separator. Types and options accept English names: `text`, `proper_name`, `email`, `phone`, `id`, `number`, `date`, `geo`, `cluster`; `column`, `type`, `length`, `lengths`, `order`, `decimal`, `catalog`, `parent`, `group`, `addCode`, `threshold`, `outliers`, `checkIds`. Use the user's language.
- `scripts/normalizar-csv.js`: **use it for local CSV files instead of writing your own script.** `node scripts/normalizar-csv.js data.csv config.json output_dir`. Example `config.json`: `{"language": "en", "columns": [...], "catalogs": {"Cat_Counties": "counties.csv"}}` (paths relative to the config; catalogs with `Code,Name,Parent,Alias` headers). It detects `,`/`;` delimiters and writes `normalized_data.csv` (UTF-8 with BOM), `normalization_report.md` and `report.json`. Then complete the report with your own analysis: assumptions, why each pending item matters, and next steps in AppSheet. For Excel, convert to CSV first (`xlsx` skill).
- `scripts/normalize-sheet.gs`: a "Normalize" menu in Google Sheets. Configure it with the `CONFIG` object (sheet, columns and the type of each); it writes `<Sheet>_normalized` without touching the original and creates `Normalization_Report` with the items to review highlighted in yellow. Setup instructions are in the file header. Its Spanish counterpart is `scripts/normalizar-hoja.gs`; paste one of the two, not both.
- `scripts/test-normalizacion.js` and `scripts/test-normalizar-hoja.js`: tests (`node scripts/test-normalizacion.js`). Run them if you modify the scripts.

For formulas without a script in Sheets: `=PROPER(TRIM(A2))` (doesn't handle particles or Mc), `=TEXT(A2,"00000")` to restore 5-digit ZIP codes, `=VALUE(SUBSTITUTE(A2,",",""))` to strip US thousands separators (in sheets with a Spanish/European locale the argument separator is `;`).

## 8. Deliverable to the user

1. Diagnosis (table: Column | Proposed type | Problems | Examples).
2. Rules to be applied (and the assumptions, especially about numbers and dates).
3. The `CONFIG` ready for the script, or the normalized sheet if you have the file.
4. Report summary: how many cells were corrected and how many need review, with the most relevant cases.
5. Next steps in AppSheet: column types, catalogs, Refs, dependent Valid_If and Regenerate structure.
