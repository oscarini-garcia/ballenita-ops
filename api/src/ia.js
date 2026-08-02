/**
 * Los dos servicios de la pantalla de IA: **qué modelos hay** y **si la clave
 * vale**.
 *
 * Los dos salen del Worker por el mismo motivo por el que sale la llamada al
 * modelo (SPECS §14.16): la clave es una credencial de pago y no vuelve entera a
 * ningún móvil. Preguntar «¿qué modelos tengo?» desde el teléfono exigiría
 * mandársela, así que la pregunta la hace el servidor y lo que viaja de vuelta
 * es la lista.
 *
 * Antes el modelo se escribía a mano en una caja de texto. Una errata —o un
 * nombre que Anthropic retiró— no se veía al guardar: se veía meses después,
 * cuando alguien pulsaba «¿Qué podríamos hacer?» y no pasaba nada.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';

function cabeceras(clave) {
  return { 'x-api-key': clave, 'anthropic-version': VERSION_API, 'content-type': 'application/json' };
}

/** El error de Anthropic, con su estado, para poder decir qué ha fallado. */
async function fallo(respuesta) {
  const datos = await respuesta.json().catch(() => ({}));
  const error = new Error(datos?.error?.message || `Anthropic respondió ${respuesta.status}`);
  error.estado = respuesta.status;
  return error;
}

/**
 * Los modelos que esta clave puede usar, los últimos primero.
 *
 * Se devuelve el identificador y el nombre con el que Anthropic lo llama: el id
 * es lo que se guarda y el nombre es lo que se lee. Enseñar solo el id obliga a
 * saberse de memoria cuál es más nuevo.
 */
export async function listarModelos({ clave, buscar = fetch }) {
  const respuesta = await buscar(`${ANTHROPIC}/models?limit=100`, { headers: cabeceras(clave) });
  if (!respuesta.ok) throw await fallo(respuesta);

  const datos = await respuesta.json().catch(() => ({}));
  return (datos.data || [])
    .filter((m) => m && m.id)
    .map((m) => ({ id: m.id, nombre: m.display_name || m.id }));
}

const FAMILIAS = ['opus', 'sonnet', 'haiku'];

/** A qué familia pertenece un identificador: `claude-3-5-sonnet-…` → `sonnet`. */
function familia(id) {
  const texto = String(id || '').toLowerCase();
  return FAMILIAS.find((f) => texto.includes(f)) || null;
}

/**
 * El equivalente más cercano de un modelo que ya no existe.
 *
 * Devuelve `null` cuando no hay nada que cambiar —el modelo sigue en la lista, o
 * no hay lista con la que comparar—, y si no, **el más nuevo de su misma
 * familia**: quien puso `claude-3-5-sonnet` quería un Sonnet, y lo que quiere
 * decir «el más cercano» es eso y no el modelo más caro que haya. Anthropic
 * devuelve su lista con los últimos primero, así que el primero que coincide de
 * familia ya es el más nuevo. Sin familia reconocible —una errata, un nombre de
 * otra época— se coge el primero de la lista, que es el último que salió.
 *
 * El motivo de que esto exista: un modelo retirado no se nota al guardarlo. Se
 * nota meses después, cuando alguien pulsa «¿Qué podríamos hacer?» y no pasa
 * nada, y para entonces nadie relaciona las dos cosas.
 */
export function masCercano(modelo, modelos = []) {
  if (!modelos.length) return null;
  if (modelos.some((m) => m.id === modelo)) return null;
  const suya = familia(modelo);
  return (suya && modelos.find((m) => familia(m.id) === suya)) || modelos[0];
}

/**
 * Hace la llamada con el modelo guardado y, **si ese modelo ya no existe, la
 * repite con el más cercano y lo deja apuntado**.
 *
 * Solo entra al camino largo con un 404, que es lo que contesta Anthropic a un
 * modelo que no reconoce: una clave mala (401) o una cuota agotada (429) no se
 * arreglan cambiando de modelo, y reintentar ahí sería gastar dos llamadas para
 * dar el mismo error. Si tampoco se puede traer la lista, se deja salir el error
 * original: decir «no existe ese modelo» ayuda más que «no se pudo listar».
 */
export async function conModeloVigente({ clave, modelo, hacer, guardar, buscar = fetch }) {
  try {
    return { resultado: await hacer(modelo) };
  } catch (e) {
    if (e.estado !== 404) throw e;
    const nuevo = masCercano(modelo, await listarModelos({ clave, buscar }).catch(() => []));
    if (!nuevo) throw e;
    await guardar(nuevo.id);
    return { resultado: await hacer(nuevo.id), cambiado: { antes: modelo, ahora: nuevo.id } };
  }
}

/**
 * ¿Vale la clave, y vale el modelo elegido?
 *
 * Se hace **la llamada de verdad**, con el tope de salida más pequeño posible:
 * comprobar solo que la clave existe no dice nada del modelo, que es la otra
 * mitad de lo que se puede tener mal. Un token de respuesta cuesta lo que cuesta
 * un token y despeja las dos dudas a la vez.
 */
export async function probar({ clave, modelo, buscar = fetch }) {
  const arranque = Date.now();
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: cabeceras(clave),
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'di ok' }],
    }),
  });
  if (!respuesta.ok) throw await fallo(respuesta);
  await respuesta.json().catch(() => ({}));
  return { ok: true, modelo, ms: Date.now() - arranque };
}
