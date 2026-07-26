#!/usr/bin/env node
/**
 * Compone el mapa del repositorio leyendo el código, no un resumen escrito a
 * mano. 🐳
 *
 * Sirve para que abrir una sesión aquí no exija estudiarse la aplicación entera
 * para saber dónde mirar. Todo lo que sale en el mapa está **declarado en algún
 * sitio del repositorio**: la primera frase de la cabecera de cada módulo, sus
 * símbolos públicos, la tabla de rutas del Worker, los destinos de la barra, las
 * tablas que se sincronizan, las variables que el código consulta de verdad, el
 * recuento de pruebas, lo que corre la integración continua y las citas al spec.
 * No hay ninguna lista de módulos aquí dentro: si un módulo sale sin
 * descripción, lo que falta es su cabecera.
 *
 * Es determinista y no usa dependencias externas, porque se ejecuta al abrir cada
 * sesión y en cada empujón: un `pip install` o un `npm install` por medio lo
 * convertirían en algo que a veces no está.
 *
 * La regla que manda sobre todas: **un mapa que miente es peor que uno
 * incompleto**. Cuando un dato no se puede extraer con garantías, no se pone. Y
 * donde un mismo hecho está declarado dos veces —la tabla de rutas y la lista de
 * la cabecera, las tablas sincronizadas en cuatro sitios— se contrastan y el
 * mapa avisa si divergen, que es lo que lo convierte además en un detector de
 * desfases.
 *
 * Tres modos:
 *   node herramientas/mapa.mjs              escribe docs/mapa.md
 *   node herramientas/mapa.mjs --contexto   lo saca por stdout (para el hook)
 *   node herramientas/mapa.mjs --verificar  código 1 si docs/mapa.md no cuadra
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escanear, cabecera, primeraFrase, simbolosPublicos,
  literalDe, cuerpoDeFuncion, citasAlSpec,
} from './escaner.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'docs', 'mapa.md');

/** Dónde vive código, en el orden en que conviene leerlo. */
const CARPETAS = ['app/src', 'api/src', 'api/herramientas', 'api/test', 'app/scripts', 'herramientas'];
const EXTENSIONES = ['.js', '.jsx', '.mjs'];

const avisos = [];
const avisar = (texto) => { if (!avisos.includes(texto)) avisos.push(texto); };

const leer = (ruta) => {
  const completa = join(RAIZ, ruta);
  return existsSync(completa) ? readFileSync(completa, 'utf8') : null;
};

/** Ficheros de código bajo `dir`, ordenados para que la salida sea estable. */
function ficheros(dir) {
  const completa = join(RAIZ, dir);
  if (!existsSync(completa)) return [];
  const salida = [];
  const recorrer = (actual) => {
    for (const entrada of readdirSync(actual).sort()) {
      const ruta = join(actual, entrada);
      if (statSync(ruta).isDirectory()) recorrer(ruta);
      else if (EXTENSIONES.some((e) => entrada.endsWith(e))) salida.push(relative(RAIZ, ruta).split(sep).join('/'));
    }
  };
  recorrer(completa);
  return salida;
}

const esPrueba = (ruta) => /\.test\.[a-z]+$/.test(ruta) || ruta.endsWith('/test/setup.js');

/** Todo el código escaneado una sola vez: el resto de secciones parte de aquí. */
const modulos = [];
for (const carpeta of CARPETAS) {
  for (const ruta of ficheros(carpeta)) {
    const texto = readFileSync(join(RAIZ, ruta), 'utf8');
    const escaneo = escanear(texto);
    modulos.push({
      ruta,
      carpeta,
      texto,
      ...escaneo,
      prueba: esPrueba(ruta),
      frase: primeraFrase(cabecera(texto, escaneo)),
      simbolos: simbolosPublicos(escaneo.desnudo),
      citas: citasAlSpec(escaneo.comentarios),
    });
  }
}
const porRuta = (ruta) => modulos.find((m) => m.ruta === ruta);
const codigo = modulos.filter((m) => !m.prueba);

// ───────────────────────────────────────────────────────────────────────────────
// Rutas HTTP: la tabla `RUTAS` contra la lista de la cabecera del módulo
// ───────────────────────────────────────────────────────────────────────────────

function rutasHttp() {
  const modulo = porRuta('api/src/index.js');
  if (!modulo) return null;

  const literal = literalDe(modulo.sinComentarios, 'RUTAS');
  if (!literal) return null;

  const declaradas = [];
  for (const m of literal.matchAll(/\[\s*'([A-Z]+)'\s*,\s*'([^']+)'\s*,\s*([\s\S]*?)\],?\s*(?=\[|$)/g)) {
    const [, metodo, camino, resto] = m;
    const nombre = /^([A-Za-z_$][\w$]*)\s*$/.exec(resto.trim());
    const manejador = nombre ? nombre[1] : null;

    // Qué credencial exige, leído del cuerpo del manejador. Sin manejador con
    // nombre (una función anónima en la propia tabla) no se afirma nada.
    let auth = '—';
    if (manejador) {
      const cuerpo = cuerpoDeFuncion(modulo.desnudo, manejador) ?? '';
      if (/\bcuentaAutenticada\s*\(/.test(cuerpo)) auth = 'sesión';
      else if (/TOKEN_SERVICIO/.test(cuerpo)) auth = 'servicio';
    }
    declaradas.push({ metodo, camino, manejador, auth });
  }

  // La misma lista, escrita otra vez en la cabecera del módulo.
  const documentadas = new Map();
  for (const linea of (cabecera(modulo.texto, modulo) ?? '').split('\n')) {
    const m = /^\s*\*?\s*(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s*·\s*(.+?)\s*$/.exec(linea);
    if (m) documentadas.set(`${m[1]} ${m[2]}`, m[3]);
  }

  const clave = (r) => `${r.metodo} ${r.camino}`;
  for (const ruta of declaradas) {
    if (!documentadas.has(clave(ruta))) {
      avisar(`\`${clave(ruta)}\` está en la tabla \`RUTAS\` de \`api/src/index.js\` y no en la lista de su cabecera.`);
    }
  }
  for (const documentada of documentadas.keys()) {
    if (!declaradas.some((r) => clave(r) === documentada)) {
      avisar(`\`${documentada}\` aparece en la cabecera de \`api/src/index.js\` pero no en la tabla \`RUTAS\`: no la sirve nadie.`);
    }
  }

  return declaradas.map((r) => ({ ...r, descripcion: documentadas.get(clave(r)) ?? '' }));
}

// ───────────────────────────────────────────────────────────────────────────────
// Navegación de la PWA
// ───────────────────────────────────────────────────────────────────────────────

function destinos() {
  const modulo = porRuta('app/src/App.jsx');
  const literal = modulo && literalDe(modulo.sinComentarios, 'TABS');
  if (!literal) return [];
  return [...literal.matchAll(/id:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
}

// ───────────────────────────────────────────────────────────────────────────────
// Tablas sincronizadas: declaradas en cuatro sitios, contrastadas entre sí
// ───────────────────────────────────────────────────────────────────────────────

/** Claves del primer nivel de un literal de objeto, contando la profundidad. */
function clavesDeNivel1(literal) {
  const claves = [];
  let profundidad = 0;
  for (let i = 0; i < literal.length; i += 1) {
    const c = literal[i];
    if (c === '{' || c === '[' || c === '(') profundidad += 1;
    else if (c === '}' || c === ']' || c === ')') profundidad -= 1;
    else if (profundidad === 0) {
      const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(literal.slice(i));
      if (m && !/[\w$]/.test(literal[i - 1] ?? '')) { claves.push(m[1]); i += m[0].length - 1; }
    }
  }
  return claves;
}

/** Almacenes vivos de Dexie: se acumulan las versiones y `null` borra. */
function almacenesDexie(modulo) {
  const vivos = [];
  for (const m of modulo.sinComentarios.matchAll(/\.version\(\d+\)\s*\.stores\(\{([\s\S]*?)\}\s*\)/g)) {
    for (const entrada of m[1].split(',')) {
      const par = /^\s*([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/.exec(entrada);
      if (!par) continue;
      const [, nombre, valor] = par;
      const indice = vivos.indexOf(nombre);
      if (valor.trim().startsWith('null')) { if (indice !== -1) vivos.splice(indice, 1); }
      else if (indice === -1) vivos.push(nombre);
    }
  }
  return vivos;
}

function tablas() {
  const cliente = porRuta('app/src/sync/tables.js');
  const servidor = porRuta('api/src/tablas.js');
  const base = porRuta('app/src/db.js');
  const sql = leer('api/migraciones/0001_esquema.sql');

  const sincronizadas = cliente
    ? [...(literalDe(cliente.sinComentarios, 'SYNC_TABLES') ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])
    : [];
  const descritas = servidor ? clavesDeNivel1(literalDe(servidor.sinComentarios, 'TABLAS') ?? '') : [];
  const locales = base ? almacenesDexie(base) : [];
  const enEsquema = sql
    ? [...sql.replace(/--[^\n]*/g, '').matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)].map((m) => m[1])
    : [];

  const falta = (nombre, donde) => avisar(`La tabla \`${nombre}\` no está declarada en ${donde}.`);
  for (const nombre of sincronizadas) {
    if (descritas.length && !descritas.includes(nombre)) falta(nombre, '`TABLAS` de `api/src/tablas.js` (el Worker la rechazaría)');
    if (enEsquema.length && !enEsquema.includes(nombre)) falta(nombre, 'la migración de D1');
    if (locales.length && !locales.includes(nombre)) falta(nombre, 'el esquema de Dexie (`app/src/db.js`)');
  }
  for (const nombre of descritas) {
    if (sincronizadas.length && !sincronizadas.includes(nombre)) {
      avisar(`\`${nombre}\` está en \`TABLAS\` del Worker pero no en \`SYNC_TABLES\` del cliente: el cliente no la subiría nunca.`);
    }
  }

  return {
    sincronizadas,
    servidor: enEsquema.filter((t) => !sincronizadas.includes(t)),
    soloLocales: locales.filter((t) => !sincronizadas.includes(t)),
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Configuración: lo que el código consulta de verdad
// ───────────────────────────────────────────────────────────────────────────────

/** `wrangler.toml` sin comentarios: los `#` de fuera de una cadena. */
function tomlLimpio(texto) {
  return texto.split('\n').map((linea) => {
    let dentro = null;
    for (let i = 0; i < linea.length; i += 1) {
      const c = linea[i];
      if (dentro) { if (c === dentro) dentro = null; }
      else if (c === '"' || c === "'") dentro = c;
      else if (c === '#') return linea.slice(0, i);
    }
    return linea;
  }).join('\n');
}

function entornoDelWorker() {
  const leidas = new Set();
  for (const modulo of modulos.filter((m) => m.ruta.startsWith('api/src/'))) {
    for (const m of modulo.desnudo.matchAll(/\benv\.([A-Z][A-Z0-9_]*)\b/g)) leidas.add(m[1]);
  }

  const toml = leer('api/wrangler.toml');
  const declaradas = new Map();
  if (toml) {
    const limpio = tomlLimpio(toml);
    const bloqueVars = /\[vars\]([\s\S]*?)(?=\n\[|$)/.exec(limpio);
    for (const m of (bloqueVars?.[1] ?? '').matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.+?)\s*$/gm)) {
      declaradas.set(m[1], `\`[vars]\` = ${m[2]}`);
    }
    for (const m of limpio.matchAll(/binding\s*=\s*"([^"]+)"/g)) {
      declaradas.set(m[1], 'binding de D1 (`wrangler.toml`)');
    }
  }

  return [...leidas].sort().map((nombre) => ({
    nombre,
    origen: declaradas.get(nombre) ?? 'no declarada en `wrangler.toml` (secreto u opcional)',
  }));
}

function configuracionEnCaliente() {
  const bruto = leer('app/public/config.json');
  if (!bruto) return [];
  // Las claves con `_` delante son notas para quien edite el fichero.
  const claves = Object.keys(JSON.parse(bruto)).filter((c) => !c.startsWith('_'));

  const consumidas = new Set();
  for (const modulo of modulos.filter((m) => m.ruta.startsWith('app/src/') && !m.prueba)) {
    for (const m of modulo.desnudo.matchAll(/\b(?:configuracion|config|conf)\s*\??\.\s*([A-Za-z_$][\w$]*)/g)) {
      consumidas.add(m[1]);
    }
  }

  for (const clave of claves) {
    if (!consumidas.has(clave)) {
      avisar(`\`${clave}\` está en \`config.json\` y ningún módulo de \`app/src\` la lee como propiedad de la configuración.`);
    }
  }
  return claves.map((clave) => ({ clave, leida: consumidas.has(clave) }));
}

function variablesDeBuild() {
  const leidas = new Set();
  for (const modulo of modulos.filter((m) => m.ruta.startsWith('app/') && !m.prueba)) {
    for (const m of modulo.desnudo.matchAll(/import\.meta\.env\s*\??\.\s*(VITE_[A-Z0-9_]*)/g)) leidas.add(m[1]);
  }

  const inyectadas = new Set();
  for (const { texto } of flujosDeTrabajo()) {
    for (const m of texto.matchAll(/^\s*(VITE_[A-Z0-9_]+)\s*:/gm)) inyectadas.add(m[1]);
  }

  for (const nombre of leidas) {
    if (!inyectadas.has(nombre)) avisar(`\`${nombre}\` se lee en \`app/\` y ningún flujo de \`.github/workflows\` la inyecta en el build.`);
  }
  for (const nombre of inyectadas) {
    if (!leidas.has(nombre)) avisar(`\`${nombre}\` se inyecta en el build y ningún módulo la lee.`);
  }
  return [...leidas].sort();
}

// ───────────────────────────────────────────────────────────────────────────────
// Pruebas y automatizaciones
// ───────────────────────────────────────────────────────────────────────────────

function pruebas() {
  const paquetes = [
    { nombre: 'app', prefijo: 'app/', manifiesto: 'app/package.json' },
    { nombre: 'api', prefijo: 'api/', manifiesto: 'api/package.json' },
  ];
  return paquetes.map((paquete) => {
    const suyos = modulos.filter((m) => m.prueba && m.ruta.startsWith(paquete.prefijo) && /\.test\./.test(m.ruta));
    const casos = suyos.reduce(
      (total, m) => total + [...m.desnudo.matchAll(/^\s*(?:it|test)\s*(?:\.\w+)?\s*\(/gm)].length,
      0,
    );
    const manifiesto = JSON.parse(leer(paquete.manifiesto) ?? '{}');
    return { ...paquete, ficheros: suyos.length, casos, comando: manifiesto.scripts?.test ?? '' };
  });
}

let cacheFlujos = null;
function flujosDeTrabajo() {
  if (cacheFlujos) return cacheFlujos;
  const dir = join(RAIZ, '.github/workflows');
  cacheFlujos = !existsSync(dir) ? [] : readdirSync(dir).sort()
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({ fichero: f, texto: readFileSync(join(dir, f), 'utf8') }));
  return cacheFlujos;
}

/**
 * Disparadores y comandos de cada flujo, leídos del YAML por indentación.
 *
 * No se interpreta YAML completo a propósito: solo se sacan las dos cosas que se
 * pueden leer sin ambigüedad —el bloque `on:` y los `run:` de una sola línea— y
 * los guiones de varias líneas se cuentan sin transcribirlos, porque un script
 * empotrado no cabe en un mapa y resumirlo sería inventarlo.
 */
function automatizaciones() {
  return flujosDeTrabajo().map(({ fichero, texto }) => {
    const lineas = texto.split('\n');
    const nombre = /^name:\s*(.+)$/m.exec(texto)?.[1]?.trim() ?? fichero;

    const disparadores = [];
    let dentroDeOn = false;
    let actual = null;
    for (const linea of lineas) {
      if (/^on:\s*$/.test(linea)) { dentroDeOn = true; continue; }
      if (dentroDeOn && /^\S/.test(linea)) break;
      if (!dentroDeOn || linea.trim() === '' || linea.trim().startsWith('#')) continue;

      const sangria = linea.length - linea.trimStart().length;
      const contenido = linea.trim();
      if (sangria === 2) {
        actual = { nombre: contenido.replace(/:.*$/, ''), detalles: [] };
        disparadores.push(actual);
      } else if (sangria > 2 && actual) {
        const m = /^([a-z_]+):\s*(.+)$/.exec(contenido);
        if (m) actual.detalles.push(`${m[1]} ${m[2]}`);
      }
    }

    const comandos = [];
    let bloques = 0;
    for (const linea of lineas) {
      const m = /^\s*-?\s*run:\s*(.*)$/.exec(linea);
      if (!m) continue;
      const orden = m[1].trim();
      // `run:` a secas no es un comando: es el `defaults.run` del trabajo.
      if (orden === '') continue;
      if (orden === '|' || orden === '>') bloques += 1;
      else if (!comandos.includes(orden)) comandos.push(orden);
    }

    const cron = [...texto.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
    return { fichero, nombre, disparadores, comandos, bloques, cron };
  });
}

/** ¿Hay algo que se ejecute por horario, en Actions o en el propio Worker? */
function programadas() {
  const cron = automatizaciones().flatMap((f) => f.cron);
  const enElWorker = modulos.some((m) => m.ruta.startsWith('api/src/') && /\bscheduled\s*\(/.test(m.desnudo));
  return { cron, enElWorker };
}

// ───────────────────────────────────────────────────────────────────────────────
// Spec ↔ código, leído de las citas de los comentarios
// ───────────────────────────────────────────────────────────────────────────────

function correspondenciaConElSpec() {
  const spec = leer('docs/SPECS.md');
  if (!spec) return [];

  const titulos = new Map();
  for (const m of spec.matchAll(/^#{2,4}\s+(\d+(?:\.\d+)*(?:-\w+)?)\.?\s+(.+?)\s*$/gm)) {
    if (!titulos.has(m[1])) titulos.set(m[1], m[2]);
    // `14.5-bis` también responde por `14.5` si nadie más lo hace.
    const base = m[1].replace(/-\w+$/, '');
    if (!titulos.has(base)) titulos.set(base, m[2]);
  }

  const citas = new Map();
  for (const modulo of codigo) {
    for (const cita of modulo.citas) {
      if (!citas.has(cita)) citas.set(cita, []);
      citas.get(cita).push(basename(modulo.ruta));
    }
  }

  const ordenar = (a, b) => {
    const na = a.split('.').map(Number);
    const nb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(na.length, nb.length); i += 1) {
      if ((na[i] ?? -1) !== (nb[i] ?? -1)) return (na[i] ?? -1) - (nb[i] ?? -1);
    }
    return 0;
  };

  const filas = [];
  for (const cita of [...citas.keys()].sort(ordenar)) {
    const titulo = titulos.get(cita);
    if (!titulo) {
      avisar(`El código cita \`§${cita}\` y \`docs/SPECS.md\` no tiene esa sección.`);
      continue;
    }
    filas.push({ cita, titulo, modulos: [...new Set(citas.get(cita))].sort() });
  }
  return filas;
}

// ───────────────────────────────────────────────────────────────────────────────
// Composición
// ───────────────────────────────────────────────────────────────────────────────

const TOPE_SIMBOLOS = 6;

/**
 * Los módulos agrupados por carpeta, en el orden en que conviene leerlos.
 *
 * El recorrido del disco mezcla ficheros y subcarpetas alfabéticamente, así que
 * `app/src/App.jsx` sale antes de `app/src/auth/` y `app/src/db.js` después: la
 * misma carpeta aparecería dos veces en el mapa. Se reordena por carpeta —según
 * `CARPETAS`, que pone delante lo que más se toca— y dentro por ruta.
 */
function enOrdenDeLectura(lista) {
  return [...lista].sort((a, b) => {
    const peso = CARPETAS.indexOf(a.carpeta) - CARPETAS.indexOf(b.carpeta);
    if (peso !== 0) return peso;
    const dirA = dirname(a.ruta);
    const dirB = dirname(b.ruta);
    if (dirA !== dirB) return dirA < dirB ? -1 : 1;
    return a.ruta < b.ruta ? -1 : 1;
  });
}

/** Los símbolos que aportan algo: no el que solo repite el nombre del fichero. */
function simbolosUtiles(modulo) {
  const nombreDelFichero = basename(modulo.ruta).replace(/\.[a-z]+$/, '');
  const utiles = modulo.simbolos.filter((s) => s !== `${nombreDelFichero} (default)`);
  if (utiles.length === 0) return '';
  const visibles = utiles.slice(0, TOPE_SIMBOLOS).join(', ');
  return utiles.length > TOPE_SIMBOLOS ? `${visibles} · +${utiles.length - TOPE_SIMBOLOS} más` : visibles;
}

function componer() {
  const l = [];
  const app = JSON.parse(leer('app/package.json') ?? '{}');
  const api = JSON.parse(leer('api/package.json') ?? '{}');

  // El cuerpo se compone antes de la cabecera: las secciones son las que van
  // llenando la lista de avisos, y los avisos van arriba para que se vean.
  const cuerpo = [];

  cuerpo.push('## Las dos piezas', '');
  const suites = pruebas();
  const suiteDe = (nombre) => suites.find((s) => s.nombre === nombre);
  cuerpo.push(`- **\`app/\`** v${app.version ?? '?'} — ${app.description ?? ''}`);
  cuerpo.push(`  ${suiteDe('app')?.casos ?? 0} pruebas en ${suiteDe('app')?.ficheros ?? 0} ficheros · \`npm test\` → \`${suiteDe('app')?.comando ?? ''}\``);
  cuerpo.push(`- **\`api/\`** v${api.version ?? '?'} — ${api.description ?? ''}`);
  cuerpo.push(`  ${suiteDe('api')?.casos ?? 0} pruebas en ${suiteDe('api')?.ficheros ?? 0} ficheros · \`npm test\` → \`${suiteDe('api')?.comando ?? ''}\``);
  cuerpo.push('');

  const rutas = rutasHttp();
  if (rutas?.length) {
    cuerpo.push('## Rutas que sirve el Worker', '');
    cuerpo.push('De la tabla `RUTAS` de `api/src/index.js`; la descripción, de la lista de su cabecera.');
    cuerpo.push('`exige`: `sesión` = llama a `cuentaAutenticada` · `servicio` = comprueba `TOKEN_SERVICIO`.', '');
    cuerpo.push('| | ruta | exige | qué hace |', '| --- | --- | --- | --- |');
    for (const r of rutas) {
      cuerpo.push(`| \`${r.metodo}\` | \`${r.camino}\` | ${r.auth} | ${r.descripcion || '—'} |`);
    }
    cuerpo.push('');
  }

  const barra = destinos();
  if (barra.length) {
    cuerpo.push('## Barra de la PWA', '', `${barra.map((t) => `**${t.label}** (\`${t.id}\`)`).join(' · ')}`, '');
  }

  const t = tablas();
  if (t.sincronizadas.length) {
    cuerpo.push('## Tablas', '');
    cuerpo.push(`- **Se sincronizan** (${t.sincronizadas.length}, declaradas y contrastadas en \`sync/tables.js\`, \`api/src/tablas.js\`, la migración de D1 y Dexie): ${t.sincronizadas.map((x) => `\`${x}\``).join(', ')}`);
    if (t.servidor.length) cuerpo.push(`- **Solo del servidor**: ${t.servidor.map((x) => `\`${x}\``).join(', ')}`);
    if (t.soloLocales.length) cuerpo.push(`- **Solo locales** (no salen del móvil): ${t.soloLocales.map((x) => `\`${x}\``).join(', ')}`);
    cuerpo.push('');
  }

  cuerpo.push('## Configuración que el código consulta de verdad', '');
  const entorno = entornoDelWorker();
  if (entorno.length) {
    cuerpo.push('**Worker** (`env.*` leídas en `api/src`):', '');
    for (const v of entorno) cuerpo.push(`- \`${v.nombre}\` — ${v.origen}`);
    cuerpo.push('');
  }
  const enCaliente = configuracionEnCaliente();
  if (enCaliente.length) {
    cuerpo.push(`**PWA** (\`app/public/config.json\`, leído al arrancar): ${enCaliente.map((c) => `\`${c.clave}\`${c.leida ? '' : ' ⚠️ sin leer'}`).join(', ')}`, '');
  }
  const build = variablesDeBuild();
  if (build.length) cuerpo.push(`**Horneadas en el build**: ${build.map((v) => `\`${v}\``).join(', ')}`, '');

  cuerpo.push('## Automatizaciones', '');
  for (const f of automatizaciones()) {
    const disparadores = f.disparadores
      .map((d) => (d.detalles.length ? `${d.nombre} (${d.detalles.join('; ')})` : d.nombre))
      .join(' · ');
    cuerpo.push(`- **${f.nombre}** \`.github/workflows/${f.fichero}\``);
    cuerpo.push(`  cuando: ${disparadores || '—'}`);
    if (f.comandos.length) cuerpo.push(`  corre: ${f.comandos.map((c) => `\`${c}\``).join(', ')}${f.bloques ? ` (+${f.bloques} guiones de varias líneas)` : ''}`);
  }
  const prog = programadas();
  cuerpo.push('', prog.cron.length
    ? `Por horario: ${prog.cron.map((c) => `\`${c}\``).join(', ')}`
    : 'Nada corre por horario: ningún `schedule:` en los flujos'
      + `${prog.enElWorker ? ', pero el Worker sí tiene un handler `scheduled`' : ' ni handler `scheduled` en el Worker'}.`);
  cuerpo.push('');

  cuerpo.push('## Módulos', '', 'Primera frase de la cabecera de cada módulo, y sus símbolos públicos debajo.');
  let carpetaActual = null;
  const sinCabecera = [];
  for (const modulo of enOrdenDeLectura(codigo)) {
    const dir = dirname(modulo.ruta);
    if (dir !== carpetaActual) { cuerpo.push('', `**\`${dir}/\`**`, ''); carpetaActual = dir; }
    const nombre = basename(modulo.ruta);
    if (!modulo.frase) sinCabecera.push(modulo.ruta);
    cuerpo.push(`- \`${nombre}\` — ${modulo.frase || '**sin cabecera** ← escríbele una'}`);
    const simbolos = simbolosUtiles(modulo);
    if (simbolos) cuerpo.push(`  ↳ ${simbolos}`);
  }
  cuerpo.push('');
  if (sinCabecera.length) {
    avisar(`${sinCabecera.length} módulo(s) sin cabecera: ${sinCabecera.join(', ')}. El mapa no puede describir lo que no está escrito.`);
  }

  const spec = correspondenciaConElSpec();
  if (spec.length) {
    cuerpo.push('## Qué parte del spec implementa cada módulo', '');
    cuerpo.push('Leído de las citas que los comentarios del código hacen a `docs/SPECS.md`.', '');
    for (const fila of spec) {
      cuerpo.push(`- **§${fila.cita}** ${fila.titulo} → ${fila.modulos.map((m) => `\`${m}\``).join(', ')}`);
    }
    cuerpo.push('');
  }

  const enCurso = seccionEnCurso();
  if (enCurso) cuerpo.push(enCurso, '');

  // ── Cabecera, ya con los avisos recogidos ──
  l.push('# Mapa de Ballena Ops 🐳', '');
  l.push('<!-- GENERADO por herramientas/mapa.mjs leyendo el código. NO se edita a mano. -->');
  l.push('Dónde mirar sin leerse la aplicación entera. Si algo falta aquí, falta en el código.', '');

  if (avisos.length) {
    l.push(`## ⚠️ Desfases (${avisos.length})`, '', 'Un hecho declarado en dos sitios que ya no coinciden:', '');
    for (const aviso of avisos) l.push(`- ${aviso}`);
    l.push('');
  } else {
    l.push('## ✅ Sin desfases', '', 'Cada hecho declarado dos veces coincide con su gemelo.', '');
  }

  return `${[...l, ...cuerpo].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

/**
 * La sección «En curso» de CLAUDE.md, que es lo único escrito a mano.
 *
 * Se copia tal cual y no se deduce de nada: qué decisión está pendiente no está
 * en el código, y fingir que sí lo está sería la peor clase de mentira para un
 * fichero generado. Va al final porque es lo que cambia por otras razones.
 */
function seccionEnCurso() {
  const claude = leer('CLAUDE.md');
  const m = claude && /^##\s+En curso\s*$([\s\S]*?)(?=^##\s|\Z)/m.exec(claude);
  const texto = m?.[1]?.trim();
  return texto ? `## En curso\n\n<!-- lo único a mano: se copia de CLAUDE.md -->\n\n${texto}` : null;
}

// ───────────────────────────────────────────────────────────────────────────────

const modo = process.argv[2] ?? '';
const mapa = componer();

if (modo === '--contexto') {
  process.stdout.write(mapa);
} else if (modo === '--verificar') {
  const guardado = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : null;
  if (guardado === mapa) {
    console.log(`✅ docs/mapa.md corresponde al código (${mapa.split('\n').length} líneas, ${avisos.length} desfase(s)).`);
  } else {
    const esperado = mapa.split('\n');
    const actual = (guardado ?? '').split('\n');
    const i = esperado.findIndex((linea, n) => linea !== actual[n]);
    console.error('❌ docs/mapa.md no corresponde al código. Corre `node herramientas/mapa.mjs` y añade el resultado.');
    if (guardado === null) console.error('   docs/mapa.md no existe.');
    else {
      console.error(`   primera diferencia, línea ${i + 1}:`);
      console.error(`   guardado: ${JSON.stringify(actual[i] ?? '(fin del fichero)')}`);
      console.error(`   código:   ${JSON.stringify(esperado[i] ?? '(fin del fichero)')}`);
    }
    process.exit(1);
  }
} else {
  writeFileSync(DESTINO, mapa);
  console.log(`✅ docs/mapa.md escrito: ${mapa.split('\n').length} líneas, ${codigo.length} módulos, ${avisos.length} desfase(s).`);
  for (const aviso of avisos) console.log(`   ⚠️ ${aviso.replace(/`/g, '')}`);
}
