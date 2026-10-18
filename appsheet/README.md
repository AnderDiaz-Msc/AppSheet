# AppSheet skill for Claude

**English** | [Español](README.es.md)

A skill for [Claude Code](https://claude.com/claude-code) / Claude that turns it into a **Google AppSheet** expert, including the spreadsheet data behind your apps. Fully bilingual: it answers in English or Spanish and ships its documentation in both languages.

## What it does

- **Expressions:** writes and debugs formulas (`SELECT`, `LOOKUP`, `REF_ROWS`, `[_THISROW]`, Valid_If, Show_If…).
- **App design:** tables, keys, Refs, slices, views, actions, roles and security filters.
- **Automations:** bots, emails, PDFs from `<<Start>>` templates, webhooks and Apps Script.
- **Integrations:** AppSheet API v2 and n8n.
- **Troubleshooting:** a catalog of real-world issues (symptom → cause → fix): PDFs that won't open or show an old version, stuck sync, schema mismatch, `Cannot compare List with Text`, bots firing repeatedly, outdated Apps Script deployments, broken webhook JSON, slow apps.
- **Spreadsheet normalization:** proper names (`mary MCDONALD` → `Mary McDonald`), numbers (`$1,053.50` → `1053.5`, `1.053` → `1053`), IDs, ZIP codes and PINs as text with leading zeros, dates, phone numbers, and geographic hierarchies: State › County › City (FIPS codes) or Departamento/Estado › Municipio › Vereda (DIVIPOLA). Includes Google Sheets scripts that produce a review report.

## Installation

Copy this folder into your skills directory:

- Windows: `C:\Users\<user>\.claude\skills\appsheet\`
- macOS / Linux: `~/.claude/skills/appsheet/`

```bash
git clone https://github.com/AnderDiaz-Msc/AppSheet.git
```

Restart Claude Code. The skill activates automatically when you talk about AppSheet or about cleaning up a spreadsheet for an app, in English or Spanish.

## Structure

```
SKILL.md                      Main instructions (loaded by Claude; routes by language)
docs/instrucciones.es.md      Spanish translation of SKILL.md, for readers
references/
  en/  es/                    Same six guides in English and Spanish:
    expressions.md              Functions, patterns and traps
    data-modeling.md            Tables, Refs, views, actions, security
    automation.md               Bots, templates, PDFs
    api-integrations.md         AppSheet API, webhooks, Apps Script, n8n
    troubleshooting.md          Real issues: symptom → cause → fix
    sheet-normalization.md      Data normalization and geography (US and Latin America)
scripts/
  normalizacion-core.js       Normalization functions (Node and Apps Script), messages in en/es
  normalize-sheet.gs          "Normalize" menu for Google Sheets (English)
  normalizar-hoja.gs          "Normalizar" menu for Google Sheets (Spanish)
  normalizar-csv.js           Normalize a local CSV with Node
  test-normalizacion.js       Core tests: node scripts/test-normalizacion.js
  test-normalizar-hoja.js     Sheets script tests (mocked): node scripts/test-normalizar-hoja.js
evals/evals.json              Skill test cases
```

## Normalize a local CSV

```bash
node scripts/normalizar-csv.js data.csv config.json output/
```

`config.json`:
```json
{
  "language": "en",
  "columns": [
    {"column": "Customer ID", "type": "id"},
    {"column": "Name", "type": "proper_name"},
    {"column": "Amount", "type": "number"},
    {"column": "Date", "type": "date"},
    {"column": "State", "type": "geo", "catalog": "States", "addCode": true},
    {"column": "County", "type": "geo", "catalog": "Counties", "parent": "State", "addCode": true},
    {"column": "ZIP", "type": "id", "length": 5, "lengths": [5, 5], "unique": false, "zipState": "State"},
    {"column": "City", "type": "cluster", "group": "County"}
  ],
  "catalogs": {"States": "states.csv", "Counties": "counties.csv"}
}
```
Catalogs are CSV files with `Code,Name,Parent,Alias` headers (aliases separated by `|`, e.g. `CA|Calif`). For the US, build them from the Census Bureau's FIPS codes. Output: `normalized_data.csv`, `normalization_report.md` and `report.json`. The original file is never modified.

Column types: `text`, `proper_name`, `email`, `phone`, `id`, `number`, `date`, `geo`, `cluster`. With `"language": "en"`, dates default to MM/DD/YYYY and the decimal separator to `.`.

## Use the normalizer in Google Sheets

1. In your sheet: *Extensions › Apps Script*.
2. Create `normalizacion-core.gs` with the contents of `scripts/normalizacion-core.js`, and `normalize-sheet.gs` with the contents of `scripts/normalize-sheet.gs`.
3. Adjust the `CONFIG` object (sheet name and the type of each column), save and reload the sheet.
4. Menu *Normalize › Normalize configured sheet*. The original isn't modified: `<Sheet>_normalized` and `Normalization_Report` are created.

## Tests

```bash
node scripts/test-normalizacion.js
node scripts/test-normalizar-hoja.js
```
