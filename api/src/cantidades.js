/**
 * Cuánto de cada ingrediente, y en qué se compra.
 *
 * Dos cosas que el modelo hace bien y que nadie va a rellenar a mano en cuarenta
 * ingredientes: **poner el número que falta** —«30 mejillones para 12»— y decir
 * **cómo se compra eso** —«el arroz, en paquetes de 1 kg»—. Lo segundo es el
 * dato sin el cual no se puede redondear: 1,62 kg no se compran, dos paquetes
 * de uno sí.
 *
 * Lo que **no** hace el modelo es estirar la receta para la gente que hay. Eso
 * es una regla de tres con los pesos que ya existen (`lib/compra.js`), y
 * conviene que no la toque: una multiplicación que unas veces dé 3 kg y otras
 * 2,8 no vale para comprar.
 *
 * Como en las ideas de plan (§14.19-bis), **los nombres no viajan**: al modelo
 * le llega el plato, para cuántos es y qué ingredientes le faltan. Quién come no
 * aporta nada para decir cuánto arroz lleva una paella.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';
const TOPE_DE_SALIDA = 1024;

export const INSTRUCCION = [
  'Eres quien pone las cantidades de una receta para un grupo grande.',
  'Te doy el nombre del plato, para cuántas raciones es y los ingredientes que',
  'les falta la cantidad. Para cada uno di cuánto hace falta **para esas',
  'raciones**, en la unidad en la que se cocina (kg, g, l, ud), y en qué formato',
  'se compra en un supermercado español: el tamaño del envase y cómo se llama',
  '(paquete, malla, bandeja, bote, brick, docena).',
  'Responde SOLO con un JSON:',
  '{"cantidades":[{"nombre":"…","cantidad":0,"unidad":"kg",',
  '"lote":{"tamano":1,"unidad":"kg","nombre":"paquete"}}]}.',
  '«nombre» tiene que ser exactamente el que te he dado. «cantidad» es un número.',
  'Si algo se compra suelto y no en envase, deja «lote» en null.',
].join(' ');

/** El material, en las palabras con las que se lee. */
export function materialDelPlato({ plato, raciones, ingredientes }) {
  return [
    `Plato: ${plato || 'sin nombre'}`,
    `Para: ${raciones > 0 ? `${raciones} raciones` : 'no se sabe para cuántos; supón 12'}`,
    `Ingredientes sin cantidad: ${ingredientes.join(', ')}`,
  ].join('\n');
}

/** Del texto del modelo a la lista, sin fiarse de que venga limpio. */
export function leerCantidades(texto, pedidos = []) {
  const recorte = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  let datos;
  try {
    datos = JSON.parse(recorte);
  } catch {
    return [];
  }
  // Solo se admite lo que se pidió: un nombre que no estaba en la lista es una
  // línea que aparecería sola en la receta de alguien.
  const admitidos = new Map(pedidos.map((n) => [String(n).trim().toLowerCase(), n]));
  const vistos = new Set();

  return (datos?.cantidades || [])
    .map((c) => {
      const nombre = admitidos.get(String(c?.nombre ?? '').trim().toLowerCase());
      const cantidad = Number(c?.cantidad);
      if (!nombre || !Number.isFinite(cantidad) || cantidad <= 0) return null;
      if (vistos.has(nombre)) return null;
      vistos.add(nombre);
      const tamano = Number(c?.lote?.tamano);
      return {
        nombre,
        cantidad,
        unidad: String(c?.unidad ?? '').trim(),
        lote: Number.isFinite(tamano) && tamano > 0
          ? { tamano, unidad: String(c?.lote?.unidad ?? '').trim(), nombre: String(c?.lote?.nombre ?? '').trim() }
          : null,
      };
    })
    .filter(Boolean);
}

export async function pedirCantidades({ clave, modelo, material, pedidos, instruccion = INSTRUCCION, buscar = fetch }) {
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': clave,
      'anthropic-version': VERSION_API,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: TOPE_DE_SALIDA,
      system: instruccion,
      messages: [{ role: 'user', content: material }],
    }),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message || `la API del modelo respondió ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }

  const texto = (datos.content || [])
    .filter((bloque) => bloque.type === 'text')
    .map((bloque) => bloque.text)
    .join('')
    .trim();

  return leerCantidades(texto, pedidos);
}
