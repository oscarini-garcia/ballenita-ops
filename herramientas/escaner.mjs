/**
 * Escáner léxico de JavaScript: separa el código de sus comentarios y literales.
 *
 * Existe porque `herramientas/mapa.mjs` tiene que leer el código de verdad y ni
 * Node ni Python traen un analizador de JavaScript en su biblioteca estándar. La
 * alternativa —expresiones regulares sobre el fichero en bruto— se equivoca en
 * los dos sentidos: encuentra un `export` dentro de una cadena y se pierde uno
 * detrás de un comentario que menciona llaves.
 *
 * Esto no es un AST y no pretende serlo. Es un autómata sobre los estados que sí
 * están definidos por la gramática léxica —comentario de línea, comentario de
 * bloque, las tres clases de cadena, literal de expresión regular— y por eso
 * acierta donde una expresión regular no puede. Lo que devuelve son dos vistas
 * del mismo fichero, alineadas carácter a carácter con el original para que los
 * números de línea sigan valiendo:
 *
 * - `sinComentarios`: el código con los comentarios en blanco y las cadenas
 *   intactas. Para leer datos declarados (una tabla de rutas, unas etiquetas).
 * - `desnudo`: además con el interior de las cadenas en blanco. Para buscar
 *   estructura (`export`, `env.ALGO`) sin que la mención de un ejemplo en un
 *   comentario cuele como declaración.
 *
 * `--verificar` compara la salida byte a byte, así que el escáner tiene que ser
 * determinista: nada de heurísticas que dependan del orden de recorrido.
 */

/** Caracteres tras los que una barra abre un literal de expresión regular. */
const ANTES_DE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '\n']);

/** Palabras tras las que una barra abre un literal, no una división. */
const PALABRAS_ANTES_DE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'do', 'else', 'yield', 'await', 'case']);

/**
 * ¿La barra en `i` abre una expresión regular o divide?
 *
 * Se decide por el último carácter significativo anterior, que es exactamente
 * como lo resuelve un analizador de verdad. Si es un operador o un abridor, lo
 * que viene es un literal; si es un identificador, un cierre o un número, es una
 * división. Las palabras reservadas hay que mirarlas aparte porque acaban en
 * letra y parecerían un identificador (`return /x/` divide, si no).
 */
function abreRegex(texto, i) {
  let j = i - 1;
  while (j >= 0 && (texto[j] === ' ' || texto[j] === '\t')) j -= 1;
  if (j < 0) return true;

  const anterior = texto[j];
  if (ANTES_DE_REGEX.has(anterior)) return true;
  if (!/[A-Za-z0-9_$]/.test(anterior)) return false;

  let k = j;
  while (k >= 0 && /[A-Za-z0-9_$]/.test(texto[k])) k -= 1;
  return PALABRAS_ANTES_DE_REGEX.has(texto.slice(k + 1, j + 1));
}

/**
 * Recorre el fichero y devuelve las dos vistas más la lista de comentarios.
 *
 * Los caracteres que se descartan se sustituyen por espacios, y los saltos de
 * línea se conservan siempre: así cualquier posición de las vistas es la misma
 * posición del original, y una línea encontrada en `desnudo` es la línea del
 * fichero. Sin eso habría que llevar un mapa de posiciones aparte, que es una
 * fuente de errores de desplazamiento por uno.
 */
export function escanear(texto) {
  // `split('')` y no `Array.from`: hacen falta unidades UTF-16, las mismas con
  // las que indexan `texto[i]` y `texto.length`. `Array.from` agrupa por punto de
  // código y un solo emoji —y este repositorio está lleno— desalinearía las
  // vistas del original a partir de ahí, con el resultado de atribuir cada
  // hallazgo a una línea equivocada.
  const sinComentarios = texto.split('');
  const desnudo = texto.split('');
  const comentarios = [];

  // Pila de contextos anidados. Una plantilla puede llevar `${…}` con código
  // dentro, y ese código puede abrir otra plantilla; sin pila no se sabe si una
  // llave cierra una sustitución o un bloque cualquiera.
  const pila = [];
  const cima = () => pila[pila.length - 1];

  const n = texto.length;
  let i = 0;

  const borrar = (vistas, desde, hasta) => {
    for (let k = desde; k < hasta; k += 1) {
      if (texto[k] === '\n') continue;
      for (const vista of vistas) vista[k] = ' ';
    }
  };

  while (i < n) {
    const c = texto[i];

    // ── Dentro del texto de una plantilla ──
    if (cima()?.tipo === 'plantilla') {
      if (c === '\\') { borrar([desnudo], i, i + 2); i += 2; continue; }
      if (c === '`') { pila.pop(); i += 1; continue; }
      if (c === '$' && texto[i + 1] === '{') {
        pila.push({ tipo: 'sustitucion', llaves: 0 });
        i += 2;
        continue;
      }
      borrar([desnudo], i, i + 1);
      i += 1;
      continue;
    }

    // ── Código ──
    const siguiente = texto[i + 1];

    if (c === '/' && siguiente === '/') {
      let fin = texto.indexOf('\n', i);
      if (fin === -1) fin = n;
      comentarios.push({ inicio: i, fin, tipo: 'linea', texto: texto.slice(i, fin) });
      borrar([sinComentarios, desnudo], i, fin);
      i = fin;
      continue;
    }

    if (c === '/' && siguiente === '*') {
      let fin = texto.indexOf('*/', i + 2);
      fin = fin === -1 ? n : fin + 2;
      comentarios.push({ inicio: i, fin, tipo: 'bloque', texto: texto.slice(i, fin) });
      borrar([sinComentarios, desnudo], i, fin);
      i = fin;
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && texto[j] !== c && texto[j] !== '\n') {
        if (texto[j] === '\\') j += 1;
        j += 1;
      }
      const fin = Math.min(j + 1, n);
      borrar([desnudo], i + 1, fin - 1);
      i = fin;
      continue;
    }

    if (c === '`') {
      pila.push({ tipo: 'plantilla' });
      i += 1;
      continue;
    }

    if (c === '{' && cima()?.tipo === 'sustitucion') {
      cima().llaves += 1;
      i += 1;
      continue;
    }

    if (c === '}' && cima()?.tipo === 'sustitucion') {
      if (cima().llaves === 0) pila.pop();
      else cima().llaves -= 1;
      i += 1;
      continue;
    }

    if (c === '/' && abreRegex(texto, i)) {
      let j = i + 1;
      let enClase = false;
      let cerrado = false;
      while (j < n && texto[j] !== '\n') {
        const d = texto[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '[') enClase = true;
        else if (d === ']') enClase = false;
        else if (d === '/' && !enClase) { j += 1; cerrado = true; break; }
        j += 1;
      }
      if (cerrado) {
        while (j < n && /[dgimsuvy]/.test(texto[j])) j += 1;
        borrar([desnudo], i, j);
        i = j;
        continue;
      }
      // Sin cierre antes del salto de línea no era un literal: era una división.
    }

    i += 1;
  }

  return {
    sinComentarios: sinComentarios.join(''),
    desnudo: desnudo.join(''),
    comentarios,
  };
}

/** Quita del principio el shebang y todas las sentencias `import` completas. */
function sinPreambulo(codigo) {
  let resto = codigo.replace(/^#![^\n]*\n/, '');
  let previo;
  do {
    previo = resto;
    resto = resto
      .replace(/^\s+/, '')
      // `import … from '…'` (incluidas las listas en varias líneas) y `import '…'`.
      .replace(/^import\s[\s\S]*?\sfrom\s*['"][^'"\n]*['"];?/, '')
      .replace(/^import\s*['"][^'"\n]*['"];?/, '');
  } while (resto !== previo);
  return resto;
}

/**
 * La cabecera del módulo: el primer comentario que no tiene código delante.
 *
 * «Delante» admite el shebang y el bloque de `import`, porque en este
 * repositorio la mitad de los módulos abren importando y ponen la cabecera justo
 * después. Exigir la línea 1 daría once módulos por indocumentados teniéndolo
 * escrito, que es precisamente el tipo de mentira que el mapa no debe contar.
 *
 * Si el primer comentario válido es de línea, se pegan los `//` seguidos, que es
 * como se escribe aquí un párrafo de cabecera.
 */
export function cabecera(texto, escaneo = escanear(texto)) {
  const { comentarios, desnudo } = escaneo;

  const primero = comentarios[0];
  if (!primero) return null;
  if (sinPreambulo(desnudo.slice(0, primero.inicio)).trim() !== '') return null;
  if (primero.tipo === 'bloque') return primero.texto;

  // Un comentario de línea arrastra los que le siguen pegados: así es como se
  // escribe aquí un párrafo de cabecera con `//`. Un hueco con código, una línea
  // en blanco o un cambio de tipo cortan la racha.
  const bloque = [primero];
  for (let k = 1; k < comentarios.length; k += 1) {
    const otro = comentarios[k];
    const hueco = texto.slice(bloque[bloque.length - 1].fin, otro.inicio);
    if (otro.tipo !== 'linea' || hueco.trim() !== '' || hueco.split('\n').length > 2) break;
    bloque.push(otro);
  }
  return bloque.map((c) => c.texto).join('\n');
}

/** Deja el texto de un comentario en prosa: sin marcas, sin adornos, en un párrafo. */
export function prosa(comentario) {
  if (!comentario) return '';
  return comentario
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((linea) => linea.replace(/^\s*(\/\/+|\*)/, '').trim())
    // Las líneas decorativas (las cajas de guiones) no dicen nada.
    .filter((linea) => !/^[─\-=*_·]+$/.test(linea))
    .join('\n')
    .trim();
}

/**
 * La primera frase, que es la que va al mapa.
 *
 * Una frase acaba en punto **seguido de espacio y de mayúscula o fin**. Cortar
 * en cualquier punto partiría una cita al spec o un «v2.» por la mitad, y media
 * frase en el mapa es peor que ninguna.
 *
 * Falta un caso que la mayúscula no salva: «p. ej. Dinero → Gastos» tiene punto,
 * espacio y mayúscula detrás y no acaba nada. Se resuelve por la palabra de
 * delante: una de una o dos letras minúsculas es una abreviatura, no el final de
 * una frase. Ninguna frase de verdad termina en «ej» ni en «p».
 */
export function primeraFrase(comentario, limite = 190) {
  const parrafo = prosa(comentario).split(/\n\s*\n/)[0] || '';
  const plano = parrafo.replace(/\s+/g, ' ').trim();
  if (!plano) return '';

  let frase = plano;
  for (let i = 0; i < plano.length; i += 1) {
    if (plano[i] !== '.' && plano[i] !== '!' && plano[i] !== '?') continue;
    const cola = plano.slice(i + 1);
    if (cola === '') { frase = plano.slice(0, i + 1); break; }
    if (!cola.startsWith(' ')) continue;
    if (/(?:^|[\s(])[a-záéíóúñ]{1,2}$/.test(plano.slice(0, i))) continue;
    const tras = cola.trimStart();
    if (tras === '' || /^[A-ZÁÉÍÓÚÑ¿¡«(]/.test(tras)) { frase = plano.slice(0, i + 1); break; }
  }

  frase = frase.trim();
  if (frase.length > limite) frase = `${frase.slice(0, limite - 1).trimEnd()}…`;
  return frase;
}

/**
 * Los símbolos que el módulo exporta, leídos de sus sentencias `export`.
 *
 * Se busca sobre la vista desnuda y anclado a principio de línea: así ni un
 * `export` citado en un comentario ni uno dentro de una cadena entran en la
 * lista. `export * from` se omite a propósito —no nombra nada— en vez de
 * inventar un nombre para él.
 */
export function simbolosPublicos(desnudo) {
  const simbolos = [];
  const anotar = (nombre) => {
    if (nombre && !simbolos.includes(nombre)) simbolos.push(nombre);
  };

  const patrones = [
    /^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
    /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
    /^export\s+class\s+([A-Za-z_$][\w$]*)/gm,
  ];
  for (const patron of patrones) {
    for (const m of desnudo.matchAll(patron)) anotar(m[1]);
  }

  for (const m of desnudo.matchAll(/^export\s+default\s+(?:async\s+)?(?:function\s*\*?\s*|class\s+)?([A-Za-z_$][\w$]*)?/gm)) {
    anotar(m[1] ? `${m[1]} (default)` : 'default');
  }

  // `export { a, b as c }` — sin `from`, que sería una reexportación.
  for (const m of desnudo.matchAll(/^export\s*\{([^}]*)\}\s*(?!from)/gm)) {
    for (const parte of m[1].split(',')) {
      const trozos = parte.trim().split(/\s+as\s+/);
      anotar((trozos[1] || trozos[0] || '').trim());
    }
  }

  return simbolos;
}

/**
 * El literal que se le asigna a `nombre`, delimitado contando corchetes.
 *
 * Contar es lo que permite que un literal con corchetes o llaves dentro —una
 * tabla de rutas con funciones, un descriptor de tablas anidado— salga entero,
 * donde una expresión regular con `[^\]]*` se cortaría en el primer cierre.
 */
export function literalDe(codigo, nombre) {
  const patron = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:const|let|var)\\s+${nombre}\\s*=\\s*`, 'g');
  const m = patron.exec(codigo);
  if (!m) return null;

  const inicio = m.index + m[0].length;
  const abre = codigo[inicio];
  const cierra = abre === '[' ? ']' : abre === '{' ? '}' : null;
  if (!cierra) return null;

  let profundidad = 0;
  for (let i = inicio; i < codigo.length; i += 1) {
    if (codigo[i] === abre) profundidad += 1;
    else if (codigo[i] === cierra) {
      profundidad -= 1;
      if (profundidad === 0) return codigo.slice(inicio + 1, i);
    }
  }
  return null;
}

/**
 * El cuerpo de una función de primer nivel, para poder mirar a quién llama.
 *
 * Se delimita también contando llaves sobre la vista desnuda, que es la única
 * forma de no cortar en una llave que viva dentro de una cadena.
 */
export function cuerpoDeFuncion(desnudo, nombre) {
  const patron = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?function\\s*\\*?\\s*${nombre}\\s*\\(`);
  const m = patron.exec(desnudo);
  if (!m) return null;

  const abre = desnudo.indexOf('{', m.index + m[0].length);
  if (abre === -1) return null;

  let profundidad = 0;
  for (let i = abre; i < desnudo.length; i += 1) {
    if (desnudo[i] === '{') profundidad += 1;
    else if (desnudo[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return desnudo.slice(abre + 1, i);
    }
  }
  return null;
}

/**
 * Las citas al spec que aparecen en los comentarios del módulo.
 *
 * Aquí no se escribe ninguna de ejemplo con su número: este fichero también lo
 * lee el mapa, y una cita de muestra saldría en la tabla de correspondencias como
 * si el escáner implementase esa sección del spec.
 */
export function citasAlSpec(comentarios) {
  const citas = new Set();
  for (const comentario of comentarios) {
    for (const m of comentario.texto.matchAll(/§\s*(\d+(?:\.\d+)*)/g)) citas.add(m[1]);
  }
  return [...citas];
}
