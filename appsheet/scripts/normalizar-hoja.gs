/**
 * Normalizador de hojas para AppSheet (Google Apps Script, runtime V8).
 *
 * Instalación: en la hoja, Extensiones › Apps Script. Crea dos archivos:
 *   1. normalizacion-core.gs  ← pega el contenido de normalizacion-core.js
 *   2. normalizar-hoja.gs     ← pega este archivo
 * Edita CONFIG, guarda y recarga la hoja: aparece el menú "Normalizar".
 *
 * Seguridad: nunca sobrescribe la hoja original. Escribe "<Hoja>_normalizada"
 * y "Reporte_normalizacion" (filas a revisar en amarillo). Revisa el reporte,
 * corrige lo pendiente y solo entonces reemplaza los datos que usa AppSheet,
 * en una ventana sin usuarios con cambios pendientes, y ejecuta
 * Regenerate structure en el editor de AppSheet.
 *
 * Catálogos geográficos: una pestaña por nivel con encabezados
 *   Codigo | Nombre | Padre | Alias      (Alias separados por "|")
 * Padre = código del nivel superior. En Colombia, usa DIVIPOLA (DANE).
 */

var CONFIG = {
  hoja: 'Datos',
  columnas: [
    { columna: 'Documento', tipo: 'id' },
    { columna: 'Nombre', tipo: 'nombre_propio' },
    { columna: 'Email', tipo: 'email' },
    { columna: 'Telefono', tipo: 'telefono' },
    { columna: 'Valor', tipo: 'numero', decimal: ',' },
    { columna: 'Fecha', tipo: 'fecha', orden: 'DMY' },
    { columna: 'Departamento', tipo: 'geo', catalogo: 'Cat_Departamentos', agregarCodigo: true },
    { columna: 'Municipio', tipo: 'geo', catalogo: 'Cat_Municipios', padre: 'Departamento', agregarCodigo: true },
    { columna: 'Vereda', tipo: 'agrupar', grupo: 'Municipio' }
  ]
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Normalizar')
    .addItem('Normalizar hoja configurada', 'normalizarHojaConfigurada')
    .addToUi();
}

function leerCatalogos_(ss, config) {
  var catalogos = {};
  config.columnas.forEach(function (c) {
    if (c.tipo !== 'geo' || catalogos[c.catalogo]) return;
    var sh = ss.getSheetByName(c.catalogo);
    if (!sh) throw new Error('Falta la pestaña de catálogo "' + c.catalogo + '"');
    var v = sh.getDataRange().getValues();
    var h = v.shift().map(function (x) { return String(x).trim().toLowerCase(); });
    var col = function (n) { return h.indexOf(n); };
    if (col('codigo') === -1 || col('nombre') === -1) throw new Error('El catálogo "' + c.catalogo + '" necesita columnas Codigo y Nombre');
    catalogos[c.catalogo] = v.filter(function (f) { return String(f[col('nombre')]).trim(); }).map(function (f) {
      return {
        codigo: String(f[col('codigo')]),
        nombre: String(f[col('nombre')]).trim(),
        padre: col('padre') === -1 ? '' : String(f[col('padre')]),
        alias: col('alias') === -1 ? '' : String(f[col('alias')])
      };
    });
  });
  return catalogos;
}

function hojaNueva_(ss, nombre) {
  var sh = ss.getSheetByName(nombre);
  if (sh) sh.clear(); else sh = ss.insertSheet(nombre);
  return sh;
}

function normalizarHojaConfigurada() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var origen = ss.getSheetByName(CONFIG.hoja);
  if (!origen) throw new Error('No existe la hoja "' + CONFIG.hoja + '"');
  var valores = origen.getDataRange().getValues();
  var encabezados = valores.shift().map(function (x) { return String(x).trim(); });

  var res = normalizarTabla(encabezados, valores, CONFIG.columnas, leerCatalogos_(ss, CONFIG), { idioma: 'es' });

  var destino = hojaNueva_(ss, CONFIG.hoja + '_normalizada');
  var nFilas = res.filas.length + 1, nCols = res.encabezados.length;
  // Formato texto antes de escribir: conserva ceros a la izquierda en IDs, códigos y teléfonos.
  res.columnasTexto.forEach(function (i) { destino.getRange(1, i + 1, nFilas, 1).setNumberFormat('@'); });
  destino.getRange(1, 1, nFilas, nCols).setValues([res.encabezados].concat(res.filas));
  destino.setFrozenRows(1);

  var rep = hojaNueva_(ss, 'Reporte_normalizacion');
  var filasRep = [['Fila', 'Columna', 'Original', 'Nuevo', 'Estado', 'Detalle']].concat(
    res.reporte.map(function (r) { return [r.fila, r.columna, r.original, r.nuevo, r.estado, r.detalle]; }));
  rep.getRange(1, 1, filasRep.length, 6).setNumberFormat('@').setValues(filasRep);
  rep.setFrozenRows(1);
  if (res.reporte.length) {
    rep.getRange(2, 1, res.reporte.length, 6).setBackgrounds(res.reporte.map(function (r) {
      var c = r.revisar ? '#fff2cc' : null;
      return [c, c, c, c, c, c];
    }));
  }

  var pendientes = res.reporte.filter(function (r) { return r.revisar; }).length;
  SpreadsheetApp.getUi().alert('Normalización terminada.\n' +
    (res.reporte.length - pendientes) + ' celdas corregidas, ' + pendientes + ' para revisar (en amarillo en Reporte_normalizacion).');
}
