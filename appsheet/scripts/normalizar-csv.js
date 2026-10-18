#!/usr/bin/env node
/**
 * ES: Normaliza un CSV local con el núcleo de la skill.
 * EN: Normalizes a local CSV with the skill's core.
 *
 *   node normalizar-csv.js <datos.csv> <config.json> <carpeta_salida>
 *
 * config.json (claves en español o inglés / Spanish or English keys):
 * {
 *   "idioma": "es",                       // o "language": "en"
 *   "columnas": [ {"columna": "Nombre", "tipo": "nombre_propio"}, ... ],
 *   "catalogos": { "Cat_Departamentos": "cat_departamentos.csv" }
 * }
 * {
 *   "language": "en",
 *   "columns": [ {"column": "Name", "type": "proper_name"}, ... ],
 *   "catalogs": { "States": "states.csv" }
 * }
 * Catálogos / catalogs: CSV Codigo,Nombre,Padre,Alias  (o / or Code,Name,Parent,Alias).
 * Rutas relativas al config.json / paths relative to config.json.
 *
 * Salida (es): datos_normalizados.csv, reporte_normalizacion.md, reporte.json
 * Output (en): normalized_data.csv, normalization_report.md, report.json
 * CSV en UTF-8 con BOM y el separador del original. Nunca modifica la entrada.
 */
var fs = require('fs'), path = require('path');
var N = require('./normalizacion-core.js');

function detectarSeparador(linea) {
  var comas = (linea.match(/,/g) || []).length, pyc = (linea.match(/;/g) || []).length;
  return pyc > comas ? ';' : ',';
}

function parseCSV(txt) {
  txt = txt.replace(/^﻿/, '');
  var sep = detectarSeparador(txt.split(/\r?\n/)[0]);
  var filas = [], fila = [], campo = '', q = false;
  for (var i = 0; i < txt.length; i++) {
    var c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { campo += '"'; i++; } else q = false; } else campo += c; }
    else if (c === '"') q = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return { sep: sep, filas: filas.filter(function (f) { return f.some(function (x) { return String(x).trim(); }); }) };
}

function celda(v, sep) {
  if (N.esFecha(v)) v = N.fechaISO(v);
  v = v === null || v === undefined ? '' : String(v);
  return /["\n\r]/.test(v) || v.indexOf(sep) !== -1 ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function leerCatalogo(ruta) {
  var t = parseCSV(fs.readFileSync(ruta, 'utf8')).filas;
  var EN = { code: 'codigo', name: 'nombre', parent: 'padre' };
  var h = t[0].map(function (x) { var k = x.trim().toLowerCase(); return EN[k] || k; });
  var c = function (n) { return h.indexOf(n); };
  if (c('codigo') === -1 || c('nombre') === -1) throw new Error('El catálogo ' + ruta + ' necesita columnas Codigo y Nombre');
  return t.slice(1).map(function (f) {
    return { codigo: f[c('codigo')], nombre: f[c('nombre')], padre: c('padre') === -1 ? '' : f[c('padre')], alias: c('alias') === -1 ? '' : f[c('alias')] };
  });
}

var TEXTOS = {
  es: {
    datos: 'datos_normalizados.csv', reporte: 'reporte_normalizacion.md', json: 'reporte.json',
    titulo: '# Reporte de normalización', filas: 'Filas procesadas', cambios: 'Celdas corregidas', pendientes: 'Para revisar a mano',
    texto: 'Columnas que deben importarse como **texto** (conservan ceros)', revisar: '## Para revisar', aplicados: '## Cambios aplicados',
    nada: 'Nada pendiente.', sin: 'Sin cambios.', cab: '| Fila | Columna | Original | Nuevo | Detalle |',
    ok: function (f, c, r, d) { return 'OK: ' + f + ' filas, ' + c + ' cambios, ' + r + ' para revisar -> ' + d; }
  },
  en: {
    datos: 'normalized_data.csv', reporte: 'normalization_report.md', json: 'report.json',
    titulo: '# Normalization report', filas: 'Rows processed', cambios: 'Cells corrected', pendientes: 'To review manually',
    texto: 'Columns that must be imported as **plain text** (keep leading zeros)', revisar: '## To review', aplicados: '## Changes applied',
    nada: 'Nothing pending.', sin: 'No changes.', cab: '| Row | Column | Original | New | Detail |',
    ok: function (f, c, r, d) { return 'OK: ' + f + ' rows, ' + c + ' changes, ' + r + ' to review -> ' + d; }
  }
};

function main() {
  var a = process.argv.slice(2);
  if (a.length < 3) { console.error('Uso / Usage: node normalizar-csv.js <data.csv> <config.json> <output_dir>'); process.exit(1); }
  var datos = parseCSV(fs.readFileSync(a[0], 'utf8'));
  var config = JSON.parse(fs.readFileSync(a[1], 'utf8'));
  var idioma = config.idioma || config.language || 'es';
  var T = TEXTOS[idioma] || TEXTOS.es;
  var base = path.dirname(path.resolve(a[1]));
  var rutasCat = config.catalogos || config.catalogs || {};
  var catalogos = {};
  Object.keys(rutasCat).forEach(function (k) { catalogos[k] = leerCatalogo(path.resolve(base, rutasCat[k])); });

  var enc = datos.filas[0].map(function (x) { return x.trim(); });
  var res = N.normalizarTabla(enc, datos.filas.slice(1), config.columnas || config.columns, catalogos, { idioma: idioma });

  fs.mkdirSync(a[2], { recursive: true });
  var csv = [res.encabezados].concat(res.filas).map(function (f) { return f.map(function (v) { return celda(v, datos.sep); }).join(datos.sep); }).join('\r\n');
  fs.writeFileSync(path.join(a[2], T.datos), '﻿' + csv + '\r\n', 'utf8');
  var json = idioma === 'en' ? res.reporte.map(function (r) {
    return { row: r.fila, column: r.columna, original: r.original, new: r.nuevo, status: r.estado, review: r.revisar, detail: r.detalle };
  }) : res.reporte;
  fs.writeFileSync(path.join(a[2], T.json), JSON.stringify(json, null, 2), 'utf8');

  var revisar = res.reporte.filter(function (r) { return r.revisar; });
  var cambiados = res.reporte.filter(function (r) { return !r.revisar; });
  var esc = function (s) { return String(s).replace(/\|/g, '\\|'); };
  var tabla = function (rs) {
    return [T.cab, '|---|---|---|---|---|'].concat(rs.map(function (r) {
      return '| ' + r.fila + ' | ' + esc(r.columna) + ' | ' + esc(r.original) + ' | ' + esc(r.nuevo) + ' | ' + esc(r.detalle) + ' |';
    })).join('\n');
  };
  var md = T.titulo + '\n\n' +
    '- ' + T.filas + ': ' + res.filas.length + '\n- ' + T.cambios + ': ' + cambiados.length + '\n- ' + T.pendientes + ': ' + revisar.length + '\n' +
    '- ' + T.texto + ': ' + res.columnasTexto.map(function (i) { return res.encabezados[i]; }).join(', ') + '\n\n' +
    T.revisar + '\n\n' + (revisar.length ? tabla(revisar) : T.nada) + '\n\n' + T.aplicados + '\n\n' + (cambiados.length ? tabla(cambiados) : T.sin) + '\n';
  fs.writeFileSync(path.join(a[2], T.reporte), md, 'utf8');
  console.log(T.ok(res.filas.length, cambiados.length, revisar.length, a[2]));
}

main();
