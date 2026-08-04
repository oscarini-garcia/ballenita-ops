/**
 * Copia las migraciones de `migraciones/*.sql` a `src/migraciones.js`, para que
 * el Worker las lleve dentro.
 *
 * El motivo de que exista este fichero generado —en vez de importar los `.sql`
 * directamente— es doble: `wrangler` sabría empaquetarlos con una regla de
 * texto, pero `node --test` no sabe importar un `.sql`, y la suite entera
 * importa `index.js`. Un módulo de JavaScript corriente lo leen los dos.
 *
 * El riesgo de un fichero generado es que se quede viejo sin que nadie lo vea.
 * De eso se encarga `test/migraciones.test.js`: compara lo generado con el
 * directorio y falla si no coinciden, así que una migración nueva sin
 * regenerar no pasa la suite.
 *
 *   npm run generar:migraciones
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../migraciones/', import.meta.url));
const destino = fileURLToPath(new URL('../src/migraciones.js', import.meta.url));

const ficheros = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const entradas = ficheros.map((fichero) => {
  const sql = readFileSync(dir + fichero, 'utf8');
  // Lo único que hay que escapar en una plantilla: la propia comilla, el
  // dólar-llave y la barra invertida. Las migraciones no traen ninguno, pero
  // el día que lo traigan no puede ser esto lo que se rompa.
  const escapado = sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  return `  {\n    id: '${fichero.replace(/\.sql$/, '')}',\n    sql: \`${escapado}\`,\n  },`;
});

writeFileSync(
  destino,
  `// Generado por \`herramientas/generar-migraciones.mjs\` — no editar a mano.
//
// Es la copia de \`migraciones/*.sql\` que viaja dentro del Worker, para que
// quien administra pueda poner la base al día desde Ajustes → Actualizar
// (SPECS §14.23) sin un portátil delante. \`test/migraciones.test.js\` comprueba
// que coincide con el directorio: si añades una migración, vuelve a lanzar
//
//   npm run generar:migraciones

export const MIGRACIONES = [
${entradas.join('\n')}
];
`,
);

console.log(`src/migraciones.js: ${ficheros.length} migraciones (${ficheros[ficheros.length - 1]})`);
