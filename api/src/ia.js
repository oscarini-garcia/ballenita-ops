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
