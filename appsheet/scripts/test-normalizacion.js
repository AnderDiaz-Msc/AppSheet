// Pruebas del núcleo de normalización: node scripts/test-normalizacion.js
var assert = require('assert');
var N = require('./normalizacion-core.js');

var casos = 0;
function eq(real, esperado, msg) { casos++; assert.deepStrictEqual(real, esperado, msg); }

// Nombres propios
eq(N.nombrePropio('  jUAN   carlos DE la torre '), 'Juan Carlos de la Torre');
eq(N.nombrePropio('MARÍA-JOSÉ o\'neill'), 'María-José O\'Neill');
eq(N.nombrePropio('bogotá, d.c.'), 'Bogotá, D.C.');
eq(N.nombrePropio('de la pava'), 'De la Pava');
eq(N.nombrePropio('carlos iii'), 'Carlos III');

// Números
eq(N.detectarSeparadorDecimal(['1.053', '2.400.000', '35,5']), ',');
eq(N.detectarSeparadorDecimal(['1,053', '12.5']), '.');
eq(N.parsearNumero('1.053', ','), { valor: 1053, ok: true });
eq(N.parsearNumero('$ 2.400.000', ','), { valor: 2400000, ok: true });
eq(N.parsearNumero('1.053,75', ','), { valor: 1053.75, ok: true });
eq(N.parsearNumero('1,053.75', '.'), { valor: 1053.75, ok: true });
eq(N.parsearNumero('(500)', ','), { valor: -500, ok: true });
eq(N.parsearNumero('abc', ',').ok, false);
eq(N.numerosSospechosos([10, 20, 1.053, 300, 45]), [2]);

// Identificadores y contacto
eq(N.normalizarId('1.053.456'), '1053456');
eq(N.normalizarId(123, 4), '0123');
eq(N.normalizarTelefono('+57 (300) 123-4567'), '+573001234567');
eq(N.normalizarEmail(' Ana.Perez@Gmail.COM '), 'ana.perez@gmail.com');

// Fechas
var f = N.parsearFecha('05/03/2024', 'DMY');
eq([f.ok, f.valor.getDate(), f.valor.getMonth() + 1], [true, 5, 3]);
eq(N.parsearFecha('31/02/2024', 'DMY').ok, false);
eq(N.parsearFecha('2024-12-01', 'DMY').valor.getMonth(), 11);

// Fechas de otro contexto (como las que entrega Sheets) y formato local
var fechaAjena = require('vm').runInNewContext('new Date(2024, 0, 2)');
eq(fechaAjena instanceof Date, false); // confirma que la prueba usa otro realm
eq(N.parsearFecha(fechaAjena, 'DMY').ok, true);
eq(N.fechaISO(new Date(2024, 11, 31, 23, 30)), '2024-12-31');

// Geografía
var deptos = N.crearIndiceGeo([
  { codigo: '05', nombre: 'Antioquia' },
  { codigo: '11', nombre: 'Bogotá, D.C.', alias: 'Bogota|Santafe de Bogota|Distrito Capital' },
  { codigo: '76', nombre: 'Valle del Cauca', alias: 'Valle' }
]);
var mpios = N.crearIndiceGeo([
  { codigo: '05001', nombre: 'Medellín', padre: '05' },
  { codigo: '05615', nombre: 'Rionegro', padre: '05' },
  { codigo: '68615', nombre: 'Rionegro', padre: '68' },
  { codigo: '76001', nombre: 'Cali', padre: '76', alias: 'Santiago de Cali' }
]);
eq(N.buscarGeo('DEPARTAMENTO DE ANTIOQUIA', deptos).codigo, '05');
eq(N.buscarGeo('bogota d.c', deptos).codigo, '11');
eq(N.buscarGeo('valle', deptos).codigo, '76');
eq(N.buscarGeo('Medelin', mpios, '05').estado, 'aproximado');
eq(N.buscarGeo('Medelin', mpios, '05').nombre, 'Medellín');
eq(N.buscarGeo('Rionegro', mpios).estado, 'ambiguo');           // sin departamento: dos Rionegro
eq(N.buscarGeo('Rionegro', mpios, '68').codigo, '68615');      // con departamento: resuelto
eq(N.buscarGeo('Municipio de Santiago de Cali', mpios, '76').codigo, '76001');
eq(N.buscarGeo('Narnia', mpios).estado, 'sin_coincidencia');

// Veredas sin catálogo
var mapa = N.agruparVariantes(['La Esperanza', 'la esperanza', 'Vereda La Esperanza', 'La Esperansa', 'El Carmen']);
eq(mapa['Vereda La Esperanza'], 'La Esperanza');
eq(mapa['La Esperansa'], 'La Esperanza');
eq(mapa['El Carmen'], 'El Carmen');

// Tabla completa
var t = N.normalizarTabla(
  ['Documento', 'Nombre', 'Valor', 'Departamento', 'Municipio', 'Vereda'],
  [
    ['1.053.456', 'ana PÉREZ', '1.053', 'antioquia', 'medelin', 'vereda la esperanza'],
    [98765, 'luis de la cruz', '2.400.000', 'Bogota', 'Bogotá', 'La Esperanza'],
    ['0123', 'MARTA', 'xx', 'Narnia', 'Rionegro', '']
  ],
  [
    { columna: 'Documento', tipo: 'id' },
    { columna: 'Nombre', tipo: 'nombre_propio' },
    { columna: 'Valor', tipo: 'numero' },
    { columna: 'Departamento', tipo: 'geo', catalogo: 'deptos', agregarCodigo: true },
    { columna: 'Municipio', tipo: 'geo', catalogo: 'mpios', padre: 'Departamento', agregarCodigo: true },
    { columna: 'Vereda', tipo: 'agrupar', grupo: 'Municipio' }
  ],
  {
    deptos: [{ codigo: '05', nombre: 'Antioquia' }, { codigo: '11', nombre: 'Bogotá, D.C.', alias: 'Bogota' }],
    mpios: [{ codigo: '05001', nombre: 'Medellín', padre: '05' }, { codigo: '11001', nombre: 'Bogotá, D.C.', padre: '11', alias: 'Bogota' }]
  }
);
eq(t.encabezados, ['Documento', 'Nombre', 'Valor', 'Departamento', 'Municipio', 'Vereda', 'Departamento_Codigo', 'Municipio_Codigo']);
eq(t.filas[0], ['1053456', 'Ana Pérez', 1053, 'Antioquia', 'Medellín', 'La Esperanza', '05', '05001']);
eq(t.filas[1], ['98765', 'Luis de la Cruz', 2400000, 'Bogotá, D.C.', 'Bogotá, D.C.', 'La Esperanza', '11', '11001']);
eq(t.filas[2][0], '0123');
eq(t.columnasTexto, [0, 6, 7]);
var revisar = t.reporte.filter(function (x) { return x.revisar; }).map(function (x) { return x.fila + ':' + x.columna; });
eq(revisar.sort(), ['2:Municipio', '4:Departamento', '4:Documento', '4:Municipio', '4:Valor']); // 4:Documento = "0123" corto y con cero

// Veredas homónimas en municipios homónimos de distinto departamento no se mezclan
var t2 = N.normalizarTabla(
  ['Departamento', 'Municipio', 'Vereda'],
  [['Antioquia', 'Rionegro', 'San Luis'], ['Santander', 'Rionegro', 'San Luís'], ['Santander', 'Rionegro', 'San Luis']],
  [
    { columna: 'Departamento', tipo: 'geo', catalogo: 'd' },
    { columna: 'Municipio', tipo: 'geo', catalogo: 'm', padre: 'Departamento', agregarCodigo: true },
    { columna: 'Vereda', tipo: 'agrupar', grupo: 'Municipio' }
  ],
  {
    d: [{ codigo: '05', nombre: 'Antioquia' }, { codigo: '68', nombre: 'Santander' }],
    m: [{ codigo: '05615', nombre: 'Rionegro', padre: '05' }, { codigo: '68615', nombre: 'Rionegro', padre: '68' }]
  }
);
eq(t2.filas.map(function (f) { return f[3]; }), ['05615', '68615', '68615']);
eq(t2.filas[0][2], 'San Luis');
eq(t2.reporte.filter(function (x) { return x.columna === 'Vereda' && x.fila === 2; }).length, 0); // en Antioquia no se toca

// Atípicos e identificadores sospechosos
eq(N.atipicosPorMagnitud([1053, 2400000, 850000, 1200500, 500000, 3100000]), [0]);
eq(N.atipicosPorMagnitud([10, 12, 9, 11]), []);
var sos = N.idsSospechosos(['1053456', '0045678', '98765', '1098765432', '0012', '1053456']);
eq(sos.map(function (x) { return x.i; }), [1, 3, 4, 5]);
eq(/Duplicado/.test(sos[3].motivo), true);
// Con rango conocido (cédula colombiana 6-10): el de 10 dígitos ya no se marca, el de 5 sí
var sos2 = N.idsSospechosos(['1053456', '98765', '1098765432'], [6, 10]);
eq(sos2.map(function (x) { return x.i; }), [1]);

// ===== English / US mode =====
eq(N.properName('  mary-kate MCDONALD ', 'en'), 'Mary-Kate McDonald');
eq(N.properName("patrick o'brien jr.", 'en'), "Patrick O'Brien Jr.");
eq(N.properName('LUDWIG VAN BEETHOVEN', 'en'), 'Ludwig van Beethoven');
eq(N.properName('john smith iii', 'en'), 'John Smith III');
eq(N.detectarSeparadorDecimal(['$1,053.50', '2,400', '1.5']), '.');
eq(N.parseNumber('$1,053.50', '.'), { valor: 1053.5, ok: true });
eq(N.parseNumber('(300.25)', '.'), { valor: -300.25, ok: true });
eq(N.quitarPrefijoGeo('Los Angeles County'), 'Los Angeles');
eq(N.quitarPrefijoGeo('Carson City'), 'Carson City');          // "City" es parte del nombre / part of the name
eq(N.quitarPrefijoGeo('County'), 'County');                    // no deja el nombre vacío / never empties the name
eq(N.normalizeId(2134, 5), '02134');                           // ZIP que perdió el cero / ZIP that lost its zero
eq(N.normalizeId(' A-001 '), 'A-001');                         // códigos alfanuméricos intactos / alphanumeric keys untouched
eq(N.normalizeId('123-45-6789'), '123456789');

var us = N.normalizeTable(
  ['Customer ID', 'Name', 'Amount', 'Date', 'ZIP', 'State', 'County', 'City'],
  [
    ['A-001', '  mary-kate MCDONALD ', '$1,053.50', '03/05/2024', 2134, 'ca', 'Los Angeles County', 'pasadena'],
    ['A-002', "patrick o'brien jr.", '2,400', '12/31/2023', '10001', 'New york', 'kings county', 'Brooklyn'],
    ['A-003', 'john smith iii', '1,800.00', '02/30/2024', '77002', 'TX', 'Harris', 'houston'],
    ['A-004', 'ana lopez', '3.10', '07/04/2024', '92101', 'California', 'san deigo', 'San Diego'],
    ['A-005', 'bob lee', '2,950', '1/2/2024', '9021', 'CA', 'Kings', 'Pasadena ']
  ],
  [
    { column: 'Customer ID', type: 'id' },
    { column: 'Name', type: 'proper_name' },
    { column: 'Amount', type: 'number' },
    { column: 'Date', type: 'date' },
    { column: 'ZIP', type: 'id', length: 5, lengths: [5, 5] },
    { column: 'State', type: 'geo', catalog: 'states', addCode: true },
    { column: 'County', type: 'geo', catalog: 'counties', parent: 'State', addCode: true },
    { column: 'City', type: 'cluster', group: 'County' }
  ],
  {
    states: [{ codigo: '06', nombre: 'California', alias: 'CA|Calif' }, { codigo: '36', nombre: 'New York', alias: 'NY' }, { codigo: '48', nombre: 'Texas', alias: 'TX' }],
    counties: [
      { codigo: '06037', nombre: 'Los Angeles County', padre: '06' }, { codigo: '06073', nombre: 'San Diego County', padre: '06' },
      { codigo: '36047', nombre: 'Kings County', padre: '36', alias: 'Brooklyn' }, { codigo: '48201', nombre: 'Harris County', padre: '48' }
    ]
  },
  { language: 'en' }
);
eq(us.encabezados.slice(-2), ['State_Code', 'County_Code']);
eq(us.filas.map(function (f) { return f[1]; }), ['Mary-Kate McDonald', "Patrick O'Brien Jr.", 'John Smith III', 'Ana Lopez', 'Bob Lee']);
eq(us.filas.map(function (f) { return f[2]; }), [1053.5, 2400, 1800, 3.1, 2950]);
eq(N.fechaISO(us.filas[0][3]), '2024-03-05');                  // MDY por defecto en inglés / MDY default in English
eq(us.filas.map(function (f) { return f[4]; }), ['02134', '10001', '77002', '92101', '09021']);
eq(us.filas.map(function (f) { return f[9]; }), ['06037', '36047', '48201', '06073', '']);
var usRev = us.reporte.filter(function (x) { return x.revisar; });
eq(usRev.every(function (x) { return x.estado === 'review'; }), true);
var detalle = function (fila, col) { var x = usRev.filter(function (r) { return r.fila === fila && r.columna === col; })[0]; return x ? x.detalle : null; };
eq(detalle(4, 'Date'), 'Invalid date');                        // 02/30/2024
eq(detalle(5, 'County'), 'Approximate match; please confirm'); // san deigo -> San Diego County
eq(detalle(6, 'County'), 'Not found in catalog counties');     // Kings no está en California / not in CA
eq(detalle(5, 'Amount'), 'Out of scale compared with the median (1800); missing or extra group of thousands?');
eq(us.filas[4][7], 'Pasadena');                                // espacios / whitespace
eq(N.normalizarConfig({ column: 'X', type: 'cluster', addCode: true }), { columna: 'X', tipo: 'agrupar', agregarCodigo: true });
// ZIP: repetirse es normal y los ceros rellenados son esperables / repeats are normal, padded zeros expected
var zips = N.normalizeTable(['ZIP'], [[2134], ['10001'], ['10001'], ['9021'], ['123']],
  [{ column: 'ZIP', type: 'id', length: 5, lengths: [5, 5], unique: false }], {}, { language: 'en' });
eq(zips.filas.map(function (f) { return f[0]; }), ['02134', '10001', '10001', '09021', '00123']);
eq(zips.reporte.filter(function (x) { return x.revisar; }).length, 0);
// ZIP contra estado: un ZIP de Boston en una fila de California se marca y NO se borra
var zs = N.normalizeTable(['State', 'ZIP'], [['CA', 2134], ['CA', '90210'], ['NY', '10001'], ['MA', '2134']],
  [{ column: 'State', type: 'geo', catalog: 's' }, { column: 'ZIP', type: 'id', length: 5, lengths: [5, 5], unique: false, zipState: 'State' }],
  { s: [{ codigo: '06', nombre: 'California', alias: 'CA' }, { codigo: '36', nombre: 'New York', alias: 'NY' }, { codigo: '25', nombre: 'Massachusetts', alias: 'MA' }] },
  { language: 'en' });
eq(zs.filas.map(function (f) { return f[1]; }), ['02134', '90210', '10001', '02134']);
eq(zs.reporte.filter(function (x) { return x.revisar; }).map(function (x) { return x.fila + ':' + x.detalle; }),
  ["2:ZIP doesn't match the row's state (ZIPs there start with 9); left unchanged"]);

// Cédulas con rango conocido: el cero inicial sigue siendo sospechoso (solo `longitud` lo silencia)
var ced = N.normalizarTabla(['Doc'], [['1053456'], ['0045678'], ['98765432']], [{ columna: 'Doc', tipo: 'id', longitudes: [6, 10] }], {});
eq(ced.reporte.filter(function (x) { return x.revisar; }).map(function (x) { return x.fila + ':' + x.detalle; }),
  ['3:Empieza por 0; confirmar si el cero es parte del código']);
var ids = N.normalizeTable(['ID'], [['A-1'], ['A-2'], ['A-1']], [{ column: 'ID', type: 'id' }], {}, { language: 'en' });
eq(ids.reporte.filter(function (x) { return x.revisar; }).map(function (x) { return x.detalle; }), ['Duplicate (also in row 2)']);

console.log('OK: ' + casos + ' pruebas superadas');
