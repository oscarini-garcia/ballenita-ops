/**
 * Los dos encargos del editor de una receta (SPECS §14.20-bis).
 *
 * **Arreglar la lista** es el que pediste con ejemplo: se escribe «tres pinchos
 * de wagyu» en el nombre y sale `3 ud` + «Pinchos de wagyu». Es traducción, no
 * invención: lo que ya tiene número no se toca y lo que no se entiende se
 * devuelve como estaba.
 *
 * **Platos parecidos** mira el título y los ingredientes del plato abierto y
 * propone otros cinco, con la figura del regalo de `garciadoral-ops`: una tanda
 * de cinco de una vez, porque lo caro de la llamada no es el texto sino contarle
 * el contexto —una vez contado, pasar de una propuesta a otra no vuelve a pedir
 * nada—. Y llegan **enteras**: nombre, tipo e ingredientes con cantidades, para
 * que aceptar una no sea una tarde de teclear.
 *
 * Como en el resto (§14.19-bis), **los nombres de la gente no viajan**: para
 * decir qué se parece a una paella no hacen falta.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';

export const INSTRUCCION_ARREGLAR = [
  'Ordenas la lista de ingredientes de una receta, que está escrita a mano y a saco.',
  'Te doy una línea por ingrediente, con lo que haya escrito en cada campo.',
  'Para cada una devuelve la cantidad como número, la unidad (kg, g, l, ml, ud)',
  'y el nombre del ingrediente limpio, en singular o plural según toque y con la',
  'primera letra en mayúscula. «tres pinchos de wagyu» son 3, ud, «Pinchos de wagyu».',
  'Si una línea ya trae cantidad, respétala tal cual.',
  'Si no puedes sacar una cantidad —«al gusto», «un chorrito»—, deja cantidad en null',
  'y limpia solo el nombre. No inventes ingredientes ni quites ninguno.',
  'Responde SOLO con un JSON:',
  '{"lineas":[{"i":0,"cantidad":3,"unidad":"ud","nombre":"Pinchos de wagyu"}]}.',
  '«i» es el número de línea que te he dado.',
].join(' ');

export const INSTRUCCION_PARECIDOS = [
  'Propones platos para un grupo de amigos que cocina en un camping.',
  'Te doy un plato —su nombre y sus ingredientes— y los que ya hay en el catálogo.',
  'Propón exactamente cinco platos nuevos que peguen con ese, en español de España:',
  'que se hagan con maña parecida o aprovechen los mismos ingredientes. No repitas',
  'ninguno de los que ya tienen. Nada de recetas de restaurante: comida de grupo,',
  'de cacharro grande y de sitio con una cocina pequeña.',
  'De cada uno da el nombre, una frase de por qué encaja, su tipo',
  '(aperitivo, entrante, principal, acompanamiento, postre) y sus ingredientes con',
  'cantidades para 12 raciones.',
  'Responde SOLO con un JSON: {"platos":[{"que":"…","porque":"…","tipo":"principal",',
  '"ingredientes":[{"nombre":"…","cantidad":1,"unidad":"kg"}]}]}.',
  '«que» tiene menos de 40 caracteres y «porque» menos de 120.',
].join(' ');

const TIPOS = ['aperitivo', 'entrante', 'principal', 'acompanamiento', 'postre'];

/** El material de «arreglar»: las líneas tal como están, numeradas. */
export function materialDeLaLista({ plato, raciones, lineas }) {
  return [
    `Plato: ${plato || 'sin nombre'}`,
    `Para: ${raciones > 0 ? `${raciones} raciones` : 'no se sabe'}`,
    'Líneas:',
    ...lineas.map((l, i) => `${i}. cantidad="${l.cantidad ?? ''}" nombre="${l.nombre ?? ''}"`),
  ].join('\n');
}

/** El material de «parecidos»: el plato abierto y lo que ya hay. */
export function materialDelPlatoParecido({ plato, ingredientes = [], yaHay = [] }) {
  const lineas = [`Plato: ${plato || 'sin nombre'}`];
  if (ingredientes.length) lineas.push(`Lleva: ${ingredientes.join(', ')}`);
  lineas.push(yaHay.length ? `Ya tienen en el catálogo: ${yaHay.join('; ')}` : 'El catálogo está vacío.');
  return lineas.join('\n');
}

function json(texto) {
  const recorte = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  try {
    return JSON.parse(recorte);
  } catch {
    return null;
  }
}

/**
 * Lo que contesta «arreglar», admitiendo solo lo que se pidió.
 *
 * Una línea con un `i` que no existe es una línea que aparecería sola en la
 * receta de alguien, y una sin nombre borraría la que había.
 */
export function leerArreglo(texto, cuantas) {
  const datos = json(texto);
  const vistos = new Set();
  return (datos?.lineas || [])
    .map((l) => {
      const i = Number(l?.i);
      const nombre = String(l?.nombre ?? '').trim();
      if (!Number.isInteger(i) || i < 0 || i >= cuantas || !nombre || vistos.has(i)) return null;
      vistos.add(i);
      const cantidad = Number(l?.cantidad);
      return {
        i,
        nombre,
        cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : null,
        unidad: String(l?.unidad ?? '').trim(),
      };
    })
    .filter(Boolean);
}

/** Lo que contesta «parecidos». Cinco como mucho, y con su tipo del catálogo. */
export function leerParecidos(texto) {
  const datos = json(texto);
  return (datos?.platos || [])
    .map((p) => {
      const que = String(p?.que ?? '').trim();
      if (!que) return null;
      const tipo = TIPOS.includes(String(p?.tipo ?? '').trim()) ? String(p.tipo).trim() : 'principal';
      const ingredientes = (p?.ingredientes || [])
        .map((x) => {
          const nombre = String(x?.nombre ?? '').trim();
          if (!nombre) return null;
          const cantidad = Number(x?.cantidad);
          return {
            nombre,
            cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : null,
            unidad: String(x?.unidad ?? '').trim(),
          };
        })
        .filter(Boolean);
      return { que, porque: String(p?.porque ?? '').trim(), tipo, ingredientes };
    })
    .filter(Boolean)
    .slice(0, 5);
}

async function pedir({ clave, modelo, instruccion, material, tope, buscar }) {
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': VERSION_API, 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: tope, system: instruccion, messages: [{ role: 'user', content: material }] }),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message || `la API del modelo respondió ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

export async function pedirArreglo({ clave, modelo, material, cuantas, instruccion = INSTRUCCION_ARREGLAR, buscar = fetch }) {
  return leerArreglo(await pedir({ clave, modelo, instruccion, material, tope: 1536, buscar }), cuantas);
}

export async function pedirParecidos({ clave, modelo, material, instruccion = INSTRUCCION_PARECIDOS, buscar = fetch }) {
  return leerParecidos(await pedir({ clave, modelo, instruccion, material, tope: 2048, buscar }));
}
