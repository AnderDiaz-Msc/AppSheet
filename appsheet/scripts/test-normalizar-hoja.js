// Prueba de normalizar-hoja.gs con un SpreadsheetApp simulado: node scripts/test-normalizar-hoja.js
var fs = require('fs'), vm = require('vm');
var S = __dirname + '/';
function hoja(nombre, valores) {
  var sh = { nombre: nombre, valores: valores || [], formatos: {}, fondos: null, frozen: 0 };
  sh.getDataRange = function () { return { getValues: function () { return sh.valores.map(function (f) { return f.slice(); }); } }; };
  sh.getRange = function (r, c, nr, nc) {
    return {
      setNumberFormat: function (f) { sh.formatos[c] = f; return this; },
      setValues: function (v) { if (v.length !== nr || v[0].length !== nc) throw new Error('setValues tamaño ' + v.length + 'x' + v[0].length + ' != ' + nr + 'x' + nc); for (var i = 0; i < nr; i++) { sh.valores[r - 1 + i] = sh.valores[r - 1 + i] || []; for (var j = 0; j < nc; j++) sh.valores[r - 1 + i][c - 1 + j] = v[i][j]; } return this; },
      setBackgrounds: function (b) { if (b.length !== nr || b[0].length !== nc) throw new Error('setBackgrounds tamaño'); sh.fondos = b; return this; }
    };
  };
  sh.clear = function () { sh.valores = []; };
  sh.setFrozenRows = function (n) { sh.frozen = n; };
  return sh;
}
var hojas = {
  Datos: hoja('Datos', [
    ['Documento', 'Nombre', 'Email', 'Telefono', 'Valor', 'Fecha', 'Departamento', 'Municipio', 'Vereda'],
    ['1.053.456', 'ana PÉREZ', ' Ana@X.com ', '300 123 4567', '1.053', '05/03/2024', 'antioquia', 'medelin', 'vereda la esperanza'],
    [45678, 'luis de la cruz', 'malo@', '+57 310', '2.400.000', new Date(2024, 0, 2), 'Santander', 'Rionegro', 'La Esperanza'],
    ['0012', 'MARTA', 'm@y.co', '3155550102', '850.000', '31/02/2024', 'Antioquia', 'Rionegro', 'El Carmen'],
    ['77.123', 'pedro', 'p@y.co', '3005550105', '1.200.000', '2024-12-01', 'Antioquia', 'Medellín', 'La Esperansa']
  ]),
  Cat_Departamentos: hoja('Cat_Departamentos', [['Codigo', 'Nombre', 'Padre', 'Alias'], ['05', 'Antioquia', '', ''], ['68', 'Santander', '', '']]),
  Cat_Municipios: hoja('Cat_Municipios', [['Codigo', 'Nombre', 'Padre', 'Alias'], ['05001', 'Medellín', '05', ''], ['05615', 'Rionegro', '05', ''], ['68615', 'Rionegro', '68', '']])
};
var alerta = '', menu = [];
var ctx = {
  console: console,
  SpreadsheetApp: {
    getActiveSpreadsheet: function () { return { getSheetByName: function (n) { return hojas[n] || null; }, insertSheet: function (n) { return (hojas[n] = hoja(n)); } }; },
    getUi: function () { return { alert: function (m) { alerta = m; }, createMenu: function () { var o = { addItem: function (a, b) { menu.push(b); return o; }, addToUi: function () {} }; return o; } }; }
  }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(S + 'normalizacion-core.js', 'utf8'), ctx, { filename: 'normalizacion-core.gs' });
vm.runInContext(fs.readFileSync(S + 'normalizar-hoja.gs', 'utf8'), ctx, { filename: 'normalizar-hoja.gs' });
ctx.onOpen();
if (menu[0] !== 'normalizarHojaConfigurada' || typeof ctx[menu[0]] !== 'function') throw new Error('Menú apunta a función inexistente');
ctx.normalizarHojaConfigurada();
var out = hojas['Datos_normalizada'], rep = hojas['Reporte_normalizacion'];
console.log('Encabezados:', out.valores[0].join(' | '));
out.valores.slice(1).forEach(function (f) { console.log(f.map(function (v) { return v instanceof Date ? v.toISOString().slice(0, 10) : v; }).join(' | ')); });
console.log('Formato texto en columnas:', JSON.stringify(out.formatos));
console.log('Para revisar:'); rep.valores.slice(1).forEach(function (f, i) { if (f[4] === 'revisar') console.log('  ', f.join(' | ')); });
console.log('Fondos amarillos:', rep.fondos.filter(function (b) { return b[0]; }).length, '| Alerta:', alerta.replace(/\n/g, ' '));
console.log('Original intacto:', hojas.Datos.valores[1][1] === 'ana PÉREZ');
var assert = require('assert');
assert.strictEqual(out.valores[0].length, 11);
assert.deepStrictEqual(out.valores.slice(1).map(function (f) { return f[10]; }), ['05001', '68615', '05615', '05001']);
assert.strictEqual(out.formatos[1], '@');
assert.deepStrictEqual(rep.valores.slice(1).filter(function (f) { return f[4] === 'revisar'; }).map(function (f) { return f[0] + ':' + f[1]; }).sort(),
  ['2:Municipio', '2:Valor', '3:Email', '4:Documento', '4:Fecha', '5:Vereda']);
assert.strictEqual(hojas.Datos.valores[1][1], 'ana PÉREZ');
console.log('OK: normalizar-hoja.gs funciona con SpreadsheetApp simulado');

// ===== English: normalize-sheet.gs =====
hojas = {
  Data: hoja('Data', [
    ['Customer ID', 'Name', 'Email', 'Phone', 'Amount', 'Date', 'ZIP', 'State', 'County', 'City'],
    ['A-1', 'mary MCDONALD', 'M@X.com', '(555) 123-4567', '$1,053.50', '03/05/2024', 2134, 'ca', 'Los Angeles County', 'pasadena'],
    ['A-2', 'bob lee', 'bad@', '555.987.6543', '2,400', '02/30/2024', '10001', 'NY', 'kings', 'Brooklyn']
  ]),
  Cat_States: hoja('Cat_States', [['Code', 'Name', 'Parent', 'Alias'], ['06', 'California', '', 'CA'], ['36', 'New York', '', 'NY']]),
  Cat_Counties: hoja('Cat_Counties', [['Code', 'Name', 'Parent', 'Alias'], ['06037', 'Los Angeles County', '06', ''], ['36047', 'Kings County', '36', 'Brooklyn']])
};
alerta = ''; menu = [];
var ctxEn = { console: console, SpreadsheetApp: ctx.SpreadsheetApp };
vm.createContext(ctxEn);
vm.runInContext(fs.readFileSync(S + 'normalizacion-core.js', 'utf8'), ctxEn, { filename: 'normalizacion-core.gs' });
vm.runInContext(fs.readFileSync(S + 'normalize-sheet.gs', 'utf8'), ctxEn, { filename: 'normalize-sheet.gs' });
ctxEn.onOpen();
assert.strictEqual(menu[0], 'normalizeConfiguredSheet');
ctxEn.normalizeConfiguredSheet();
var outEn = hojas['Data_normalized'], repEn = hojas['Normalization_Report'];
assert.deepStrictEqual(outEn.valores[0].slice(-2), ['State_Code', 'County_Code']);
assert.deepStrictEqual(outEn.valores[1].slice(0, 5), ['A-1', 'Mary McDonald', 'm@x.com', '5551234567', 1053.5]);
assert.strictEqual(outEn.valores[1][6], '02134');
assert.deepStrictEqual(outEn.valores.slice(1).map(function (f) { return f[11]; }), ['06037', '36047']);
assert.deepStrictEqual(repEn.valores[0], ['Row', 'Column', 'Original', 'New', 'Status', 'Detail']);
assert.deepStrictEqual(repEn.valores.slice(1).filter(function (f) { return f[4] === 'review'; }).map(function (f) { return f[0] + ':' + f[1]; }).sort(), ['2:ZIP', '3:Date', '3:Email']); // 2:ZIP = ZIP de Boston en fila de California
assert.ok(/cells corrected/.test(alerta));
console.log('OK: normalize-sheet.gs works with a mocked SpreadsheetApp');
