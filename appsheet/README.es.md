# Skill AppSheet para Claude

[English](README.md) | **Español**

Skill para [Claude Code](https://claude.com/claude-code) / Claude que lo convierte en un experto en **Google AppSheet** y en los datos de hoja de cálculo que hay detrás de tus apps. Totalmente bilingüe: responde en español o en inglés e incluye su documentación en los dos idiomas.

## Qué hace

- **Expresiones:** escribe y depura fórmulas (`SELECT`, `LOOKUP`, `REF_ROWS`, `[_THISROW]`, Valid_If, Show_If…).
- **Diseño de apps:** tablas, claves, Ref, slices, vistas, acciones, roles y security filters.
- **Automatizaciones:** bots, emails, PDF con plantillas `<<Start>>`, webhooks y Apps Script.
- **Integraciones:** AppSheet API v2 y n8n.
- **Diagnóstico:** catálogo de incidencias reales (síntoma → causa → solución): PDF que no abre o se ve antiguo, sincronización bloqueada, *Schema mismatch*, `Cannot compare List with Text`, bots que se disparan de más, Apps Script desactualizado, JSON roto, apps lentas.
- **Normalización de hojas:** nombres propios (`jUAN DE la torre` → `Juan de la Torre`), números (`1.053` → `1053`, `$1,053.50` → `1053.5`), documentos, ZIP y PIN como texto con sus ceros, fechas, teléfonos y jerarquías geográficas: Departamento/Estado › Municipio › Vereda (DIVIPOLA) o State › County › City (FIPS). Incluye scripts para Google Sheets que generan un reporte de revisión.

## Instalación

Copia esta carpeta en tu directorio de skills:

- Windows: `C:\Users\<usuario>\.claude\skills\appsheet\`
- macOS / Linux: `~/.claude/skills/appsheet/`

```bash
git clone https://github.com/AnderDiaz-Msc/AppSheet.git
```

Reinicia Claude Code. La skill se activa sola cuando hablas de AppSheet o de limpiar una hoja de cálculo para una app, en español o en inglés.

## Estructura

```
SKILL.md                      Instrucciones principales (las carga Claude; dirige según el idioma)
docs/instrucciones.es.md      Traducción al español de SKILL.md, para lectura
references/
  es/  en/                    Las mismas seis guías en español y en inglés:
    expressions.md              Funciones, patrones y trampas
    data-modeling.md            Tablas, Ref, vistas, acciones, seguridad
    automation.md               Bots, plantillas, PDF
    api-integrations.md         AppSheet API, webhooks, Apps Script, n8n
    troubleshooting.md          Incidencias reales: síntoma → causa → solución
    sheet-normalization.md      Normalización de datos y geografía (Latinoamérica y EE. UU.)
scripts/
  normalizacion-core.js       Funciones de normalización (Node y Apps Script), mensajes en es/en
  normalizar-hoja.gs          Menú "Normalizar" para Google Sheets (español)
  normalize-sheet.gs          Menú "Normalize" para Google Sheets (inglés)
  normalizar-csv.js           Normalizar un CSV local con Node
  test-normalizacion.js       Pruebas del núcleo: node scripts/test-normalizacion.js
  test-normalizar-hoja.js     Prueba de los scripts de Sheets (simulado): node scripts/test-normalizar-hoja.js
evals/evals.json              Casos de prueba de la skill
```

## Normalizar un CSV local

```bash
node scripts/normalizar-csv.js datos.csv config.json salida/
```

`config.json`:
```json
{
  "idioma": "es",
  "columnas": [
    {"columna": "Documento", "tipo": "id", "longitudes": [6, 10]},
    {"columna": "Nombre", "tipo": "nombre_propio"},
    {"columna": "Valor", "tipo": "numero"},
    {"columna": "Departamento", "tipo": "geo", "catalogo": "Deptos", "agregarCodigo": true},
    {"columna": "Municipio", "tipo": "geo", "catalogo": "Mpios", "padre": "Departamento", "agregarCodigo": true},
    {"columna": "Vereda", "tipo": "agrupar", "grupo": "Municipio"}
  ],
  "catalogos": {"Deptos": "cat_departamentos.csv", "Mpios": "cat_municipios.csv"}
}
```
Los catálogos son CSV con columnas `Codigo,Nombre,Padre,Alias` (alias separados por `|`). En Colombia se pueden armar con DIVIPOLA del DANE, disponible en datos.gov.co. Salida: `datos_normalizados.csv`, `reporte_normalizacion.md` y `reporte.json`. El archivo original nunca se modifica.

Tipos de columna: `texto`, `nombre_propio`, `email`, `telefono`, `id`, `numero`, `fecha`, `geo`, `agrupar` (también aceptan sus nombres en inglés). Con `"idioma": "es"`, las fechas se leen por defecto como DD/MM/AAAA y el separador decimal es `,`.

## Usar el normalizador en Google Sheets

1. En tu hoja: *Extensiones › Apps Script*.
2. Crea `normalizacion-core.gs` con el contenido de `scripts/normalizacion-core.js`, y `normalizar-hoja.gs` con el de `scripts/normalizar-hoja.gs`.
3. Ajusta el objeto `CONFIG` (nombre de la hoja y tipo de cada columna), guarda y recarga la hoja.
4. Menú *Normalizar › Normalizar hoja configurada*. El original no se modifica: se crean `<Hoja>_normalizada` y `Reporte_normalizacion`.

## Pruebas

```bash
node scripts/test-normalizacion.js
node scripts/test-normalizar-hoja.js
```
