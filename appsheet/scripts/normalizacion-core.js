/**
 * Núcleo de normalización de datos para hojas que alimentan apps AppSheet.
 * Data-normalization core for spreadsheets that feed AppSheet apps.
 *
 * Funciones puras (sin APIs de Google): se usan desde Apps Script
 * (normalizar-hoja.gs / normalize-sheet.gs), desde Node (normalizar-csv.js)
 * y se prueban con test-normalizacion.js.
 *
 * Idioma / language: normalizarTabla(..., {idioma: 'es' | 'en'}) cambia los
 * mensajes del reporte, el sufijo de las columnas de código (_Codigo / _Code)
 * y los valores por defecto (fechas DMY/MDY, decimal ','/'.'). Los tipos y
 * opciones de config aceptan nombres en español o inglés (ver ALIAS_*).
 */

var PARTICULAS = {
  es: ['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'da', 'do', 'dos', 'van', 'von', 'en'],
  en: ['van', 'von', 'der', 'den', 'de', 'da', 'di', 'du', 'del', 'la']
};
var PREFIJOS_GEO = [
  'departamento de', 'departamento del', 'depto de', 'depto', 'dpto de', 'dpto', 'estado de', 'estado',
  'municipio de', 'municipio', 'mpio de', 'mpio', 'corregimiento de', 'corregimiento', 'correg',
  'vereda de', 'vereda', 'vda', 'inspeccion de policia', 'centro poblado',
  'state of', 'county of', 'city of', 'town of', 'township of', 'village of', 'parish of', 'borough of'
];
// Sufijos de EE. UU. ("Kings County"). No se quita "city": forma parte del nombre (Carson City, Jersey City).
var SUFIJOS_GEO = ['county', 'parish', 'borough', 'census area', 'municipality'];

// Primer dígito del ZIP por código FIPS de estado (USPS). Sirve para detectar ZIP de otro estado.
var ZIP_DIGITO_POR_FIPS = {
  '09': '0', '23': '0', '25': '0', '33': '0', '34': '0', '44': '0', '50': '0', '72': '0',
  '10': '1', '36': '1', '42': '1',
  '11': '2', '24': '2', '37': '2', '45': '2', '51': '2', '54': '2',
  '01': '3', '12': '3', '13': '3', '28': '3', '47': '3',
  '18': '4', '21': '4', '26': '4', '39': '4',
  '19': '5', '27': '5', '30': '5', '38': '5', '46': '5', '55': '5',
  '17': '6', '20': '6', '29': '6', '31': '6',
  '05': '7', '22': '7', '40': '7', '48': '7',
  '04': '8', '08': '8', '16': '8', '32': '8', '35': '8', '49': '8', '56': '8',
  '02': '9', '06': '9', '15': '9', '41': '9', '53': '9'
};

var ALIAS_TIPOS = {
  proper_name: 'nombre_propio', text: 'texto', phone: 'telefono', number: 'numero',
  date: 'fecha', cluster: 'agrupar', group: 'agrupar'
};
var ALIAS_OPCIONES = {
  column: 'columna', type: 'tipo', length: 'longitud', lengths: 'longitudes', order: 'orden',
  catalog: 'catalogo', parent: 'padre', group: 'grupo', addCode: 'agregarCodigo',
  threshold: 'umbral', outliers: 'atipicos', checkIds: 'revisarIds', unique: 'unico',
  zipState: 'zipEstado'
};

var MENSAJES = {
  es: {
    cambiado: 'cambiado', revisar: 'revisar', sufijoCodigo: '_Codigo',
    noNumero: 'No es un número válido',
    miles: function (n) { return 'Posible separador de miles leído como decimal (¿' + n + '?)'; },
    escala: function (m) { return 'Fuera de escala respecto a la mediana (' + m + '); ¿falta o sobra un grupo de miles?'; },
    sinPadre: function (p) { return 'Sin ' + p + ' válido para ubicarlo'; },
    aprox: 'Coincidencia aproximada; confirmar',
    ambiguo: function (c) { return 'Ambiguo: ' + c; },
    noCatalogo: function (c) { return 'No está en el catálogo ' + c; },
    variante: 'Variante unificada; confirmar',
    email: 'Email con formato inválido',
    fecha: 'Fecha no válida',
    duplicado: function (f) { return 'Duplicado (también en fila ' + f + ')'; },
    rango: function (l, a, b) { return 'Longitud ' + l + ' fuera del rango válido ' + a + '-' + b; },
    longitud: function (l, m) { return 'Longitud atípica (' + l + ' caracteres; lo habitual ≈ ' + m + ')'; },
    cero: 'Empieza por 0; confirmar si el cero es parte del código',
    zip: function (d) { return 'El ZIP no corresponde al estado de la fila (allí empiezan por ' + d + '); no se cambió'; },
    sinColumna: function (n) { return 'No existe la columna "' + n + '"'; },
    sinCatalogo: function (c) { return 'Catálogo vacío o inexistente: ' + c; },
    tipo: function (t) { return 'Tipo desconocido: ' + t; }
  },
  en: {
    cambiado: 'changed', revisar: 'review', sufijoCodigo: '_Code',
    noNumero: 'Not a valid number',
    miles: function (n) { return 'Possible thousands separator read as a decimal point (' + n + '?)'; },
    escala: function (m) { return 'Out of scale compared with the median (' + m + '); missing or extra group of thousands?'; },
    sinPadre: function (p) { return 'No valid ' + p + ' to place it in'; },
    aprox: 'Approximate match; please confirm',
    ambiguo: function (c) { return 'Ambiguous: ' + c; },
    noCatalogo: function (c) { return 'Not found in catalog ' + c; },
    variante: 'Spelling variant merged; please confirm',
    email: 'Invalid email format',
    fecha: 'Invalid date',
    duplicado: function (f) { return 'Duplicate (also in row ' + f + ')'; },
    rango: function (l, a, b) { return 'Length ' + l + ' outside the valid range ' + a + '-' + b; },
    longitud: function (l, m) { return 'Unusual length (' + l + ' characters; typical ≈ ' + m + ')'; },
    cero: 'Starts with 0; confirm the zero is part of the code',
    zip: function (d) { return "ZIP doesn't match the row's state (ZIPs there start with " + d + '); left unchanged'; },
    sinColumna: function (n) { return 'Column "' + n + '" not found'; },
    sinCatalogo: function (c) { return 'Catalog empty or missing: ' + c; },
    tipo: function (t) { return 'Unknown type: ' + t; }
  }
};

function mensajes(idioma) { return MENSAJES[idioma] || MENSAJES.es; }

/** Traduce nombres de tipo y opciones en inglés a los internos. {column:'Name', type:'proper_name'} -> {columna, tipo:'nombre_propio'} */
function normalizarConfig(c) {
  var r = {};
  Object.keys(c).forEach(function (k) { r[ALIAS_OPCIONES[k] || k] = c[k]; });
  if (r.tipo && ALIAS_TIPOS[r.tipo]) r.tipo = ALIAS_TIPOS[r.tipo];
  return r;
}

function limpiarEspacios(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[   \t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function quitarTildes(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Clave de comparación: sin tildes, minúsculas, sin puntuación. "Bogotá, D.C." -> "bogota dc" */
function claveComparacion(v) {
  return quitarTildes(limpiarEspacios(v)).toLowerCase()
    .replace(/[.]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/**
 * Quita prefijos ("Municipio de", "Vereda", "County of") y sufijos ("County", "Parish")
 * geográficos conservando tildes: "Vereda La Esperanza" -> "La Esperanza"; "Kings County" -> "Kings".
 */
function quitarPrefijoGeo(v) {
  var palabras = limpiarEspacios(v).split(' ');
  var k = claveComparacion(palabras.join(' '));
  for (var i = 0; i < PREFIJOS_GEO.length; i++) {
    var p = PREFIJOS_GEO[i];
    if (k.indexOf(p + ' ') === 0) { palabras = palabras.slice(p.split(' ').length); k = claveComparacion(palabras.join(' ')); break; }
  }
  for (var j = 0; j < SUFIJOS_GEO.length; j++) {
    var sf = SUFIJOS_GEO[j], n = sf.split(' ').length;
    if (palabras.length > n && k.slice(-(sf.length + 1)) === ' ' + sf) { palabras = palabras.slice(0, palabras.length - n); break; }
  }
  return palabras.join(' ');
}

/** Clave geográfica: clave de comparación sin prefijos ni sufijos geográficos. */
function claveGeo(v) {
  return claveComparacion(quitarPrefijoGeo(v));
}

/**
 * "jUAN  carlos DE la torre" -> "Juan Carlos de la Torre"; "d.c." -> "D.C."; "maría-josé" -> "María-José";
 * "mcdonald" -> "McDonald"; "o'brien" -> "O'Brien". idioma elige las partículas en minúscula.
 */
function nombrePropio(v, idioma) {
  var s = limpiarEspacios(v);
  if (!s) return '';
  var particulas = PARTICULAS[idioma] || PARTICULAS.es;
  return s.toLowerCase().split(' ').map(function (palabra, i) {
    if (/^([a-záéíóúñü]\.)+$/i.test(palabra)) return palabra.toUpperCase(); // siglas con punto: D.C.
    if (/^(i|ii|iii|iv|v|vi|vii|viii|ix|x)$/.test(palabra) && i > 0) return palabra.toUpperCase(); // números romanos
    if (i > 0 && particulas.indexOf(palabra) !== -1) return palabra;
    return palabra.split(/([-'’])/).map(function (parte) {
      if (/^mc[a-z]{2,}/.test(parte)) return 'Mc' + parte.charAt(2).toUpperCase() + parte.slice(3);
      return parte.charAt(0).toUpperCase() + parte.slice(1);
    }).join('');
  }).join(' ');
}

function normalizarEmail(v) {
  return limpiarEspacios(v).toLowerCase().replace(/\s/g, '');
}

/** Conserva solo dígitos (y un + inicial). Siempre devuelve texto para no perder ceros. */
function normalizarTelefono(v) {
  var s = limpiarEspacios(v);
  var mas = s.charAt(0) === '+' ? '+' : '';
  return mas + s.replace(/\D/g, '');
}

/**
 * Identificadores, documentos, códigos, PIN: siempre texto.
 * Numéricos: sin separadores ("1.053.456" -> "1053456"; 123 con longitud 4 -> "0123").
 * Alfanuméricos: se conservan tal cual salvo espacios ("A-001" sigue "A-001"), porque
 * cambiar una clave rompe las referencias de otras tablas.
 */
function normalizarId(v, longitud) {
  var s = limpiarEspacios(v);
  var digitos = s.replace(/[.\s,-]/g, '');
  s = /^\d+$/.test(digitos) ? digitos : s.replace(/\s/g, '');
  if (longitud && /^\d+$/.test(s) && s.length < longitud) {
    while (s.length < longitud) s = '0' + s;
  }
  return s;
}

/**
 * Decide el separador decimal de una columna a partir de sus valores de texto.
 * Devuelve ',' (estilo es-CO: 1.053,5), '.' (estilo en-US: 1,053.5) o null si no hay evidencia.
 */
function detectarSeparadorDecimal(valores) {
  var coma = 0, punto = 0;
  valores.forEach(function (v) {
    if (typeof v === 'number') return;
    var s = limpiarEspacios(v).replace(/[^\d.,-]/g, '');
    if (!s) return;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) coma++;          // 1.053 / 1.053.000 / 1.053,5
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) punto++;    // 1,053 / 1,053.5
    else if (/^-?\d+,\d+$/.test(s)) coma++;                      // 3,5
    else if (/^-?\d+\.\d+$/.test(s)) punto++;                    // 3.5
  });
  if (coma === 0 && punto === 0) return null;
  return coma >= punto ? ',' : '.';
}

/**
 * Convierte texto con formato a número. decimal = ',' o '.'.
 * Devuelve {valor, ok}. ok=false si no se pudo interpretar (se reporta para revisión).
 */
function parsearNumero(v, decimal) {
  if (typeof v === 'number') return { valor: v, ok: true };
  var s = limpiarEspacios(v).replace(/[$€£\s%]|COP|USD|MXN/gi, '');
  if (!s) return { valor: '', ok: true };
  var negativo = /^\(.*\)$/.test(s) || s.charAt(0) === '-';
  s = s.replace(/[()\-]/g, '');
  if (decimal === ',') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return { valor: v, ok: false };
  var n = parseFloat(s);
  return { valor: negativo ? -n : n, ok: true };
}

/**
 * Detecta números que probablemente ya se corrompieron al importarse
 * (p. ej. "1.053" leído como 1,053 decimal en una hoja con configuración en-US):
 * valores con exactamente 3 decimales en una columna mayoritariamente entera.
 */
function numerosSospechosos(valores) {
  var nums = valores.filter(function (v) { return typeof v === 'number'; });
  if (nums.length < 3) return [];
  var enteros = nums.filter(function (n) { return n === Math.round(n); }).length;
  if (enteros / nums.length < 0.6) return [];
  var idx = [];
  valores.forEach(function (v, i) {
    if (typeof v === 'number' && v !== Math.round(v) && /^\d+\.\d{3}$/.test(String(Math.abs(v)))) idx.push(i);
  });
  return idx;
}

function mediana(nums) {
  var s = nums.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Valores fuera de escala (≥ factor veces menores o mayores que la mediana):
 * típico de un "1.053.000" escrito como "1.053". Devuelve índices.
 */
function atipicosPorMagnitud(valores, factor) {
  factor = factor || 100;
  var nums = valores.filter(function (v) { return typeof v === 'number' && v > 0; });
  if (nums.length < 4) return [];
  var med = mediana(nums);
  var idx = [];
  valores.forEach(function (v, i) {
    if (typeof v === 'number' && v > 0 && (v * factor <= med || v >= med * factor)) idx.push(i);
  });
  return idx;
}

/**
 * Identificadores sospechosos: duplicados, longitud que se aparta ≥3 de la mediana
 * o ceros a la izquierda cuando la mayoría no los tiene. Devuelve [{i, motivo}].
 */
function idsSospechosos(valores, longitudes, idioma, opciones) {
  var M = mensajes(idioma);
  // unico: false para códigos que se repiten legítimamente (ZIP, código de municipio).
  // ceros: false cuando los ceros iniciales son esperables (se rellenó con longitud).
  var unico = !opciones || opciones.unico !== false;
  var avisarCeros = !opciones || opciones.ceros !== false;
  var res = [], vistos = {};
  var llenos = valores.filter(function (v) { return v !== ''; });
  if (!llenos.length) return res;
  var medLen = mediana(llenos.map(function (v) { return String(v).length; }));
  var conCero = llenos.filter(function (v) { return /^0/.test(v); }).length;
  valores.forEach(function (v, i) {
    if (v === '') return;
    var s = String(v), motivos = [];
    if (vistos[s] !== undefined) { if (unico) motivos.push(M.duplicado(vistos[s] + 2)); } else vistos[s] = i;
    if (longitudes) {
      if (s.length < longitudes[0] || s.length > longitudes[1]) motivos.push(M.rango(s.length, longitudes[0], longitudes[1]));
    } else if (Math.abs(s.length - medLen) >= 3) motivos.push(M.longitud(s.length, medLen));
    if (avisarCeros && /^0/.test(s) && conCero / llenos.length < 0.5) motivos.push(M.cero);
    if (motivos.length) res.push({ i: i, motivo: motivos.join('; ') });
  });
  return res;
}

/** Date de cualquier contexto (instanceof falla entre realms, p. ej. valores de Sheets). */
function esFecha(v) {
  return Object.prototype.toString.call(v) === '[object Date]';
}

/** aaaa-mm-dd con la fecha local (toISOString pasaría a UTC y podría cambiar el día). */
function fechaISO(v) {
  if (isNaN(v.getTime())) return '';
  return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
}

/**
 * Fechas de texto a Date. orden = 'DMY' (Latinoamérica/España) o 'MDY' (EE. UU.).
 * Acepta Date, dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd. Devuelve {valor, ok}.
 */
function parsearFecha(v, orden) {
  if (esFecha(v)) return { valor: v, ok: !isNaN(v.getTime()) };
  var s = limpiarEspacios(v);
  if (!s) return { valor: '', ok: true };
  var m, d, mes, a;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) { a = +m[1]; mes = +m[2]; d = +m[3]; }
  else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))) {
    a = +m[3]; if (a < 100) a += a < 50 ? 2000 : 1900;
    if (orden === 'MDY') { mes = +m[1]; d = +m[2]; } else { d = +m[1]; mes = +m[2]; }
  } else return { valor: v, ok: false };
  var f = new Date(a, mes - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== mes - 1 || f.getDate() !== d) return { valor: v, ok: false };
  return { valor: f, ok: true };
}

/** Distancia de edición con transposiciones (Damerau OSA): "deigo" -> "diego" = 1, no 2. */
function levenshtein(a, b) {
  if (a === b) return 0;
  var d = [], i, j;
  for (i = 0; i <= a.length; i++) { d[i] = [i]; }
  for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      var costo = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
      if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Similitud 0..1 entre dos claves. */
function similitud(a, b) {
  var max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * Catálogo geográfico: filas {codigo, nombre, padre, alias} (alias separados por "|").
 * padre = código del nivel superior (p. ej. código de departamento para un municipio).
 */
function crearIndiceGeo(filas) {
  return filas.map(function (f) {
    var claves = [claveGeo(f.nombre)];
    if (f.alias) String(f.alias).split('|').forEach(function (al) { if (limpiarEspacios(al)) claves.push(claveGeo(al)); });
    return { codigo: String(f.codigo), nombre: f.nombre, padre: f.padre ? String(f.padre) : '', claves: claves };
  });
}

/**
 * Busca un valor en el catálogo, opcionalmente restringido al código padre.
 * Devuelve {estado: 'exacto'|'aproximado'|'ambiguo'|'sin_coincidencia', codigo, nombre, candidatos}.
 * 'aproximado' y 'ambiguo' deben revisarse antes de aceptarse.
 */
function buscarGeo(valor, indice, codigoPadre, umbral) {
  umbral = umbral || 0.85;
  var k = claveGeo(valor);
  if (!k) return { estado: 'vacio', codigo: '', nombre: '', candidatos: [] };
  var universo = codigoPadre ? indice.filter(function (e) { return e.padre === String(codigoPadre); }) : indice;
  var exactos = universo.filter(function (e) { return e.claves.indexOf(k) !== -1; });
  if (exactos.length === 1) return { estado: 'exacto', codigo: exactos[0].codigo, nombre: exactos[0].nombre, candidatos: [] };
  if (exactos.length > 1) {
    return { estado: 'ambiguo', codigo: '', nombre: '', candidatos: exactos.map(function (e) { return e.nombre + ' (' + e.codigo + ')'; }) };
  }
  var puntuados = universo.map(function (e) {
    var mejor = Math.max.apply(null, e.claves.map(function (c) { return similitud(k, c); }));
    return { e: e, s: mejor };
  }).filter(function (x) { return x.s >= umbral; }).sort(function (x, y) { return y.s - x.s; });
  if (puntuados.length === 0) return { estado: 'sin_coincidencia', codigo: '', nombre: '', candidatos: [] };
  if (puntuados.length > 1 && puntuados[0].s - puntuados[1].s < 0.05) {
    return { estado: 'ambiguo', codigo: '', nombre: '', candidatos: puntuados.slice(0, 3).map(function (x) { return x.e.nombre + ' (' + x.e.codigo + ')'; }) };
  }
  return { estado: 'aproximado', codigo: puntuados[0].e.codigo, nombre: puntuados[0].e.nombre, candidatos: [] };
}

/**
 * Sin catálogo oficial (típico en veredas y corregimientos): agrupa variantes
 * de escritura dentro de un mismo grupo (p. ej. municipio) y propone la forma
 * más frecuente como canónica. Devuelve {original -> canonico} para revisión.
 */
function agruparVariantes(valores, umbral, idioma) {
  umbral = umbral || 0.85;
  var conteo = {};
  valores.forEach(function (v) {
    var s = limpiarEspacios(v);
    if (s) conteo[s] = (conteo[s] || 0) + 1;
  });
  var formas = Object.keys(conteo).sort(function (a, b) { return conteo[b] - conteo[a]; });
  var grupos = [];
  formas.forEach(function (f) {
    var k = claveGeo(f);
    var g = grupos.filter(function (gr) { return gr.clave === k || similitud(gr.clave, k) >= umbral; })[0];
    if (g) g.miembros.push(f); else grupos.push({ clave: k, canonico: nombrePropio(quitarPrefijoGeo(f), idioma), miembros: [f] });
  });
  var mapa = {};
  grupos.forEach(function (g) { g.miembros.forEach(function (m) { mapa[m] = g.canonico; }); });
  return mapa;
}

function textoReporte(v) {
  if (esFecha(v)) return fechaISO(v);
  return v === null || v === undefined ? '' : String(v);
}

/**
 * Normaliza una tabla completa.
 * encabezados: array de nombres; filas: array de arrays (sin encabezado).
 * config: [{columna, tipo, ...opciones}] en orden de proceso (los niveles geográficos
 *   superiores antes que los inferiores). Tipos:
 *   'texto' | 'nombre_propio' | 'email' | 'telefono' |
 *   'id' {longitud: rellena con ceros, longitudes: [min, max] válidos, unico: false si puede
 *         repetirse (ZIP, códigos de lugar), revisarIds: false para no marcar nada,
 *         zipEstado: columna geo de estado con códigos FIPS (ZIP de EE. UU.; va después de ella)} |
 *   'numero' {decimal: ','|'.' (si se omite se detecta), atipicos: false para no marcar} |
 *   'fecha' {orden: 'DMY'|'MDY'} |
 *   'geo' {catalogo, padre, umbral, agregarCodigo} | 'agrupar' {grupo, umbral}
 *   (también en inglés / also in English: text, proper_name, email, phone, id, number,
 *   date, geo, cluster; opciones column, type, length, lengths, unique, zipState, order, catalog,
 *   parent, group, addCode, threshold, outliers, checkIds)
 * catalogos: {nombre: [{codigo, nombre, padre, alias}]}
 * opciones: {idioma: 'es' | 'en'} (por defecto 'es').
 * Devuelve {encabezados, filas, reporte, columnasTexto}. Cada entrada del reporte:
 * {fila, columna, original, nuevo, estado (texto traducido), revisar (boolean), detalle}.
 * No modifica la entrada. Las columnas de código nuevas se añaden al final
 * (extremo derecho) para no desplazar las existentes.
 */
function normalizarTabla(encabezados, filas, config, catalogos, opciones) {
  var idioma = (opciones && (opciones.idioma || opciones.language)) || 'es';
  var M = mensajes(idioma);
  var enc = encabezados.slice();
  var datos = filas.map(function (f) { return f.slice(); });
  var reporte = [];
  var columnasTexto = [];
  var codigos = datos.map(function () { return {}; });
  config = config.map(normalizarConfig);

  function idx(nombre) {
    var i = enc.indexOf(nombre);
    if (i === -1) throw new Error(M.sinColumna(nombre));
    return i;
  }
  // aRevisar = false: cambio aplicado; true: requiere revisión humana.
  function registrar(r, col, original, nuevo, aRevisar, detalle) {
    if (!aRevisar && textoReporte(original) === textoReporte(nuevo)) return;
    reporte.push({
      fila: r + 2, columna: col, original: textoReporte(original), nuevo: textoReporte(nuevo),
      estado: aRevisar ? M.revisar : M.cambiado, revisar: !!aRevisar, detalle: detalle || ''
    });
  }

  config.forEach(function (c) {
    var i = idx(c.columna);
    var tipo = c.tipo;

    if (tipo === 'numero') {
      var decimal = c.decimal || detectarSeparadorDecimal(datos.map(function (f) { return f[i]; })) || (idioma === 'en' ? '.' : ',');
      var sospechosos = numerosSospechosos(datos.map(function (f) { return f[i]; }));
      datos.forEach(function (f, r) {
        var res = parsearNumero(f[i], decimal);
        if (!res.ok) registrar(r, c.columna, f[i], f[i], true, M.noNumero);
        else { registrar(r, c.columna, f[i], res.valor, false); f[i] = res.valor; }
      });
      sospechosos.forEach(function (r) {
        registrar(r, c.columna, datos[r][i], datos[r][i], true, M.miles(Math.round(datos[r][i] * 1000)));
      });
      if (c.atipicos !== false) {
        var med = mediana(datos.map(function (f) { return f[i]; }).filter(function (v) { return typeof v === 'number' && v > 0; }));
        atipicosPorMagnitud(datos.map(function (f) { return f[i]; })).forEach(function (r) {
          registrar(r, c.columna, datos[r][i], datos[r][i], true, M.escala(med));
        });
      }
      return;
    }

    if (tipo === 'geo') {
      var indice = crearIndiceGeo((catalogos && catalogos[c.catalogo]) || []);
      if (!indice.length) throw new Error(M.sinCatalogo(c.catalogo));
      var iCod = -1;
      if (c.agregarCodigo) { enc.push(c.columna + M.sufijoCodigo); iCod = enc.length - 1; columnasTexto.push(iCod); }
      datos.forEach(function (f, r) {
        var padre = c.padre ? codigos[r][c.padre] : null;
        if (c.padre && !padre) {
          if (iCod !== -1) f[iCod] = '';
          if (limpiarEspacios(f[i])) registrar(r, c.columna, f[i], f[i], true, M.sinPadre(c.padre));
          return;
        }
        var res = buscarGeo(f[i], indice, padre, c.umbral);
        if (res.estado === 'exacto' || res.estado === 'aproximado') {
          registrar(r, c.columna, f[i], res.nombre, res.estado === 'aproximado', res.estado === 'aproximado' ? M.aprox : '');
          f[i] = res.nombre;
          codigos[r][c.columna] = res.codigo;
          if (iCod !== -1) f[iCod] = res.codigo;
        } else {
          if (iCod !== -1) f[iCod] = '';
          if (res.estado !== 'vacio') {
            registrar(r, c.columna, f[i], f[i], true,
              res.estado === 'ambiguo' ? M.ambiguo(res.candidatos.join(', ')) : M.noCatalogo(c.catalogo));
          }
        }
      });
      return;
    }

    if (tipo === 'agrupar') {
      var iGrupo = c.grupo ? idx(c.grupo) : -1;
      var porGrupo = {};
      datos.forEach(function (f, r) {
        // Si el grupo es una columna geo ya resuelta, agrupa por su código: hay
        // municipios homónimos en distintos departamentos (Rionegro 05615 / 68615).
        var g = iGrupo === -1 ? '' : (codigos[r][c.grupo] ? 'cod:' + codigos[r][c.grupo] : claveComparacion(f[iGrupo]));
        (porGrupo[g] = porGrupo[g] || []).push(r);
      });
      Object.keys(porGrupo).forEach(function (g) {
        var filasG = porGrupo[g];
        var mapa = agruparVariantes(filasG.map(function (r) { return datos[r][i]; }), c.umbral, idioma);
        filasG.forEach(function (r) {
          var orig = datos[r][i];
          var canon = mapa[limpiarEspacios(orig)];
          if (canon === undefined) return;
          var soloFormato = claveGeo(orig) === claveGeo(canon) || claveComparacion(orig) === claveComparacion(canon);
          registrar(r, c.columna, orig, canon, !soloFormato, soloFormato ? '' : M.variante);
          datos[r][i] = canon;
        });
      });
      return;
    }

    if (tipo === 'id' || tipo === 'telefono') columnasTexto.push(i);
    datos.forEach(function (f, r) {
      var v = f[i], nuevo, aRevisar = false, detalle = '';
      if (tipo === 'nombre_propio') nuevo = nombrePropio(v, idioma);
      else if (tipo === 'texto') nuevo = limpiarEspacios(v);
      else if (tipo === 'email') {
        nuevo = normalizarEmail(v);
        if (nuevo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nuevo)) { aRevisar = true; detalle = M.email; }
      } else if (tipo === 'telefono') nuevo = normalizarTelefono(v);
      else if (tipo === 'id') nuevo = normalizarId(v, c.longitud);
      else if (tipo === 'fecha') {
        var res = parsearFecha(v, c.orden || (idioma === 'en' ? 'MDY' : 'DMY'));
        if (!res.ok) { nuevo = v; aRevisar = true; detalle = M.fecha; } else nuevo = res.valor;
      } else throw new Error(M.tipo(tipo));
      registrar(r, c.columna, v, nuevo, aRevisar, detalle);
      f[i] = nuevo;
    });
    if (tipo === 'id' && c.revisarIds !== false) {
      idsSospechosos(datos.map(function (f) { return f[i]; }), c.longitudes, idioma,
        { unico: c.unico, ceros: !c.longitud }).forEach(function (x) {
        registrar(x.i, c.columna, datos[x.i][i], datos[x.i][i], true, x.motivo);
      });
    }
    // ZIP de EE. UU. contra el estado ya resuelto (la columna geo del estado debe ir antes en config).
    if (tipo === 'id' && c.zipEstado) {
      datos.forEach(function (f, r) {
        var digito = ZIP_DIGITO_POR_FIPS[codigos[r][c.zipEstado]];
        var zip = String(f[i]);
        if (digito && /^\d{5}$/.test(zip) && zip.charAt(0) !== digito) registrar(r, c.columna, zip, zip, true, M.zip(digito));
      });
    }
  });

  return { encabezados: enc, filas: datos, reporte: reporte, columnasTexto: columnasTexto };
}

if (typeof module !== 'undefined') {
  module.exports = {
    limpiarEspacios: limpiarEspacios, quitarTildes: quitarTildes, claveComparacion: claveComparacion, claveGeo: claveGeo,
    nombrePropio: nombrePropio, normalizarEmail: normalizarEmail, normalizarTelefono: normalizarTelefono,
    normalizarId: normalizarId, detectarSeparadorDecimal: detectarSeparadorDecimal, parsearNumero: parsearNumero,
    numerosSospechosos: numerosSospechosos, parsearFecha: parsearFecha, similitud: similitud,
    crearIndiceGeo: crearIndiceGeo, buscarGeo: buscarGeo, agruparVariantes: agruparVariantes,
    esFecha: esFecha, fechaISO: fechaISO, atipicosPorMagnitud: atipicosPorMagnitud, idsSospechosos: idsSospechosos,
    normalizarTabla: normalizarTabla, normalizarConfig: normalizarConfig, quitarPrefijoGeo: quitarPrefijoGeo,
    // English aliases
    normalizeTable: normalizarTabla, properName: nombrePropio, parseNumber: parsearNumero, parseDate: parsearFecha,
    normalizeId: normalizarId, normalizePhone: normalizarTelefono, normalizeEmail: normalizarEmail,
    buildGeoIndex: crearIndiceGeo, findGeo: buscarGeo, clusterVariants: agruparVariantes
  };
}
