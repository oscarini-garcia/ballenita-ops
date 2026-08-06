/**
 * Pruebas del generador del mapa y de su escáner.
 *
 * La que de verdad importa es `simbolosPublicos ≡ import()`: el escáner no es un
 * AST, y afirmar que acierta no vale nada si no se comprueba. Así que se importan
 * de verdad los módulos puros del repositorio y se compara la lista que el
 * escáner deduce del texto con la que Node obtiene al cargarlos. Si algún día
 * alguien escribe un `export` de una forma que el escáner no reconoce, esta
 * prueba lo dice antes de que el mapa empiece a mentir por omisión.
 *
 * Corre con `node --test herramientas/` y no necesita instalar nada.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { escanear, cabecera, primeraFrase, simbolosPublicos, literalDe } from './escaner.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAPA = join(RAIZ, 'herramientas', 'mapa.mjs');

const escanearFichero = (ruta) => {
  const texto = readFileSync(join(RAIZ, ruta), 'utf8');
  return { texto, ...escanear(texto) };
};

// ───────────────────────────────────────────────────────────────────────────────
// El escáner contra la realidad
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Módulos puros: los que se pueden importar sin navegador ni Dexie ni React, que
 * es la condición para poder preguntarle a Node cuáles son sus exportaciones de
 * verdad. Cubren las formas de `export` que se usan en el repositorio.
 */
const PUROS = [
  'app/src/lib/reparto.js',
  'app/src/lib/money.js',
  'app/src/lib/ids.js',
  'app/src/lib/stats.js',
  'app/src/sync/tables.js',
  'api/src/tablas.js',
  'api/src/sesion.js',
  'herramientas/escaner.mjs',
];

for (const ruta of PUROS) {
  test(`los símbolos de ${ruta} son los que Node ve al importarlo`, async () => {
    const reales = Object.keys(await import(join(RAIZ, ruta))).filter((k) => k !== 'default').sort();
    const deducidos = simbolosPublicos(escanearFichero(ruta).desnudo)
      .filter((s) => !s.endsWith('(default)') && s !== 'default')
      .sort();
    assert.deepEqual(deducidos, reales, `el escáner y el import no coinciden en ${ruta}`);
  });
}

test('las vistas del escáner quedan alineadas con el original, emojis incluidos', () => {
  // Cualquier desalineación atribuiría los hallazgos a la línea equivocada.
  for (const ruta of [...PUROS, 'app/src/db.js', 'api/src/index.js', 'app/src/App.jsx']) {
    const { texto, desnudo, sinComentarios } = escanearFichero(ruta);
    assert.equal(desnudo.length, texto.length, ruta);
    assert.equal(sinComentarios.length, texto.length, ruta);
    assert.equal(desnudo.split('\n').length, texto.split('\n').length, ruta);
  }
});

test('un `export` dentro de una cadena o de un comentario no cuenta como símbolo', () => {
  const fuente = [
    "const aviso = 'export function mentira() {}'",
    '// export function tambienMentira() {}',
    '/* export const niEsta = 1 */',
    'export function verdad() {}',
    'export const otra = 2',
  ].join('\n');
  assert.deepEqual(simbolosPublicos(escanear(fuente).desnudo), ['verdad', 'otra']);
});

test('las llaves de una expresión regular o de una plantilla no descuadran el conteo', () => {
  // Una barra mal clasificada se comería el resto del fichero.
  const fuente = [
    "const patron = /['\"{}]/g",
    'const division = 10 / 2 / 1',
    'const texto = `abrir { ${ division } cerrar }`',
    'export function despues() {}',
  ].join('\n');
  assert.deepEqual(simbolosPublicos(escanear(fuente).desnudo), ['despues']);
});

test('`export { a as b }` da el nombre público, y la reexportación no cuenta', () => {
  const fuente = 'const a = 1\nexport { a as publico }\nexport * from "./otro.js"\n';
  assert.deepEqual(simbolosPublicos(escanear(fuente).desnudo), ['publico']);
});

test('literalDe delimita contando corchetes, no al primer cierre', () => {
  const fuente = "const RUTAS = [\n  ['GET', '/a', () => f([1, 2])],\n  ['POST', '/b', g],\n]\n";
  const literal = literalDe(escanear(fuente).sinComentarios, 'RUTAS');
  assert.match(literal, /'\/a'/);
  assert.match(literal, /'\/b'/, 'se cortó en el primer corchete de cierre');
});

// ───────────────────────────────────────────────────────────────────────────────
// Cabeceras y primera frase
// ───────────────────────────────────────────────────────────────────────────────

test('la cabecera se encuentra también cuando va debajo de los import', () => {
  const fuente = "import { a } from './a.js'\nimport {\n  b,\n} from './b.js'\n\n// La cabecera.\nexport const c = 1\n";
  assert.equal(primeraFrase(cabecera(fuente)), 'La cabecera.');
});

test('un comentario que va después de código no es la cabecera', () => {
  const fuente = "const x = 1\n\n// Esto documenta a y, no al módulo.\nexport const y = 2\n";
  assert.equal(cabecera(fuente), null);
});

test('el shebang no tapa la cabecera', () => {
  assert.equal(primeraFrase(cabecera('#!/usr/bin/env node\n/** Una herramienta. */\n')), 'Una herramienta.');
});

test('la primera frase no se parte en una abreviatura ni en un número de sección', () => {
  const casos = [
    ['// Divide en dos (p. ej. Gastos y Saldos) sin salir. Lo demás da igual.',
      'Divide en dos (p. ej. Gastos y Saldos) sin salir.'],
    ['// Motor de reparto (§3, §14.7 del spec). Regla de oro.',
      'Motor de reparto (§3, §14.7 del spec).'],
    ['// Sube la versión en v2. Y republica.', 'Sube la versión en v2.'],
    ['// Sin punto final', 'Sin punto final'],
  ];
  for (const [fuente, esperado] of casos) assert.equal(primeraFrase(cabecera(fuente)), esperado);
});

test('las líneas decorativas de una caja de guiones no salen en la frase', () => {
  const fuente = '// ─────────────────────────\n// Lo que dice de verdad.\n// ─────────────────────────\n';
  assert.equal(primeraFrase(cabecera(fuente)), 'Lo que dice de verdad.');
});

test('todos los módulos del repositorio tienen cabecera', () => {
  // Si esto falla, lo que falta es una cabecera; no se toca el generador.
  const salida = execFileSync('node', [MAPA, '--contexto'], { encoding: 'utf8' });
  assert.doesNotMatch(salida, /sin cabecera/, 'hay módulos sin cabecera: mira los desfases del mapa');
});

// ───────────────────────────────────────────────────────────────────────────────
// Los tres modos
// ───────────────────────────────────────────────────────────────────────────────

test('--contexto saca el mapa por stdout sin escribir nada', () => {
  const antes = readFileSync(join(RAIZ, 'docs/mapa.md'), 'utf8');
  const salida = execFileSync('node', [MAPA, '--contexto'], { encoding: 'utf8' });
  assert.match(salida, /^# Mapa de Ballena Ops/);
  assert.equal(readFileSync(join(RAIZ, 'docs/mapa.md'), 'utf8'), antes);
});

test('--contexto trae los hechos derivados del código, no un resumen', () => {
  const salida = execFileSync('node', [MAPA, '--contexto'], { encoding: 'utf8' });
  for (const esperado of [
    '/api/cambios',            // de la tabla RUTAS
    'SESION_SECRETO',          // de un env.* que el Worker lee
    'outbox',                  // del esquema de Dexie
    'reparto.js',              // de la cabecera del módulo
    'Estadísticas',            // de un título de SPECS.md citado por el código
  ]) {
    assert.match(salida, new RegExp(esperado.replace(/[/]/g, '\\/')), `falta «${esperado}» en el mapa`);
  }
});

test('--verificar pasa con el mapa al día y falla en cuanto cambia una cabecera', () => {
  execFileSync('node', [MAPA]); // deja docs/mapa.md al día
  execFileSync('node', [MAPA, '--verificar']);

  const ruta = join(RAIZ, 'app/src/lib/money.js');
  const original = readFileSync(ruta, 'utf8');
  try {
    writeFileSync(ruta, original.replace('// Todo el dinero', '// Otra cosa distinta. Todo el dinero'));
    assert.throws(
      () => execFileSync('node', [MAPA, '--verificar'], { stdio: 'pipe' }),
      (error) => error.status === 1,
      '--verificar tenía que salir con código 1 tras cambiar una cabecera',
    );
  } finally {
    writeFileSync(ruta, original);
  }
  execFileSync('node', [MAPA, '--verificar']); // y vuelve a pasar al deshacerlo
});

test('las claves de config.json se ven leídas de las dos formas', () => {
  // La clave se lee por propiedad (`configuracion.api`) o desestructurando
  // (`const { otaManifiesto } = await cargarConfiguracion()`). Contar solo la
  // primera daba un falso desfase en una clave que sí se lee.
  const salida = execFileSync('node', [MAPA, '--contexto'], { encoding: 'utf8' });
  const claves = /config\.json`, leído al arrancar\): (.+)/.exec(salida)?.[1] ?? '';
  assert.match(claves, /`api`/);
  assert.match(claves, /`otaManifiesto`/);
  assert.doesNotMatch(claves, /sin leer/, 'una clave que el código lee sale marcada como no leída');
});

test('el mapa cabe en el presupuesto de contexto', () => {
  const lineas = execFileSync('node', [MAPA, '--contexto'], { encoding: 'utf8' }).split('\n').length;
  assert.ok(lineas < 380, `el mapa se ha ido a ${lineas} líneas; el presupuesto son ~350`);
});
