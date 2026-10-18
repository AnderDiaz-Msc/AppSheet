/**
 * Sheet normalizer for AppSheet (Google Apps Script, V8 runtime).
 * English version of normalizar-hoja.gs. Paste ONE of the two, not both.
 *
 * Setup: in your sheet, Extensions › Apps Script. Create two files:
 *   1. normalizacion-core.gs  ← paste the contents of normalizacion-core.js
 *   2. normalize-sheet.gs     ← paste this file
 * Edit CONFIG, save and reload the sheet: a "Normalize" menu appears.
 *
 * Safety: it never overwrites the original sheet. It writes "<Sheet>_normalized"
 * and "Normalization_Report" (rows to review highlighted in yellow). Review the
 * report, fix what is pending, and only then replace the data AppSheet uses,
 * during a window with no users holding unsynced changes, and run
 * Regenerate structure in the AppSheet editor.
 *
 * Geographic catalogs: one tab per level with headers
 *   Code | Name | Parent | Alias      (aliases separated by "|")
 * Parent = code of the level above. In the US, use Census FIPS codes
 * (state = 2 digits, county = 5 digits; keep them as plain text).
 */

var CONFIG = {
  sheet: 'Data',
  columns: [
    { column: 'Customer ID', type: 'id' },
    { column: 'Name', type: 'proper_name' },
    { column: 'Email', type: 'email' },
    { column: 'Phone', type: 'phone' },
    { column: 'Amount', type: 'number', decimal: '.' },
    { column: 'Date', type: 'date', order: 'MDY' },
    { column: 'State', type: 'geo', catalog: 'Cat_States', addCode: true },
    { column: 'County', type: 'geo', catalog: 'Cat_Counties', parent: 'State', addCode: true },
    // After State: 2134 -> 02134, ZIPs may repeat, and a ZIP from another state is flagged
    { column: 'ZIP', type: 'id', length: 5, lengths: [5, 5], unique: false, zipState: 'State' },
    { column: 'City', type: 'cluster', group: 'County' }
  ]
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Normalize')
    .addItem('Normalize configured sheet', 'normalizeConfiguredSheet')
    .addToUi();
}

function readCatalogs_(ss, config) {
  var catalogs = {};
  var EN = { code: 'codigo', name: 'nombre', parent: 'padre' };
  config.columns.forEach(function (c) {
    if (c.type !== 'geo' || catalogs[c.catalog]) return;
    var sh = ss.getSheetByName(c.catalog);
    if (!sh) throw new Error('Missing catalog tab "' + c.catalog + '"');
    var v = sh.getDataRange().getValues();
    var h = v.shift().map(function (x) { var k = String(x).trim().toLowerCase(); return EN[k] || k; });
    var col = function (n) { return h.indexOf(n); };
    if (col('codigo') === -1 || col('nombre') === -1) throw new Error('Catalog "' + c.catalog + '" needs Code and Name columns');
    catalogs[c.catalog] = v.filter(function (f) { return String(f[col('nombre')]).trim(); }).map(function (f) {
      return {
        codigo: String(f[col('codigo')]),
        nombre: String(f[col('nombre')]).trim(),
        padre: col('padre') === -1 ? '' : String(f[col('padre')]),
        alias: col('alias') === -1 ? '' : String(f[col('alias')])
      };
    });
  });
  return catalogs;
}

function freshSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (sh) sh.clear(); else sh = ss.insertSheet(name);
  return sh;
}

function normalizeConfiguredSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var source = ss.getSheetByName(CONFIG.sheet);
  if (!source) throw new Error('Sheet "' + CONFIG.sheet + '" not found');
  var values = source.getDataRange().getValues();
  var headers = values.shift().map(function (x) { return String(x).trim(); });

  var res = normalizarTabla(headers, values, CONFIG.columns, readCatalogs_(ss, CONFIG), { idioma: 'en' });

  var target = freshSheet_(ss, CONFIG.sheet + '_normalized');
  var nRows = res.filas.length + 1, nCols = res.encabezados.length;
  // Plain-text format before writing: keeps leading zeros in IDs, ZIP codes, FIPS codes and phones.
  res.columnasTexto.forEach(function (i) { target.getRange(1, i + 1, nRows, 1).setNumberFormat('@'); });
  target.getRange(1, 1, nRows, nCols).setValues([res.encabezados].concat(res.filas));
  target.setFrozenRows(1);

  var rep = freshSheet_(ss, 'Normalization_Report');
  var repRows = [['Row', 'Column', 'Original', 'New', 'Status', 'Detail']].concat(
    res.reporte.map(function (r) { return [r.fila, r.columna, r.original, r.nuevo, r.estado, r.detalle]; }));
  rep.getRange(1, 1, repRows.length, 6).setNumberFormat('@').setValues(repRows);
  rep.setFrozenRows(1);
  if (res.reporte.length) {
    rep.getRange(2, 1, res.reporte.length, 6).setBackgrounds(res.reporte.map(function (r) {
      var c = r.revisar ? '#fff2cc' : null;
      return [c, c, c, c, c, c];
    }));
  }

  var pending = res.reporte.filter(function (r) { return r.revisar; }).length;
  SpreadsheetApp.getUi().alert('Normalization finished.\n' +
    (res.reporte.length - pending) + ' cells corrected, ' + pending + ' to review (highlighted in yellow in Normalization_Report).');
}
