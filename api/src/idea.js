/**
 * El encargo del botón «Mejorarla» del editor de una idea (SPECS §14.24).
 *
 * Es la figura de «Arreglar» del editor de receta: se manda lo escrito tal
 * cual y vuelve lo mismo mejor contado. El modelo **no guarda nada** — lo que
 * devuelve rellena el editor, se puede deshacer, y guardar sigue siendo el
 * botón de siempre. Y como en el resto (§14.19-bis), **los nombres de la gente
 * no viajan**: para pulir «playa cala sur llevar sombrilla» no hacen falta.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';

export const INSTRUCCION_MEJORAR = [
  'Mejoras la redacción de una idea de plan para un grupo de amigos que veranea junto.',
  'Te doy el título y la descripción tal como los apuntó alguien desde el móvil,',
  'y a veces un enlace. Devuelve la misma idea mejor contada, en español de España:',
  'un título corto y concreto (menos de 40 caracteres) y una descripción de una a',
  'tres frases con lo práctico — qué es, qué conviene llevar o saber.',
  'No inventes datos que no estén: si no se sabe el sitio, el precio o el horario,',
  'no te los saques. Conserva los nombres propios exactamente como están escritos.',
  'Si ya está bien contada, devuélvela casi igual: mejorar no es alargar.',
  'Responde SOLO con un JSON: {"titulo":"…","descripcion":"…"}.',
].join(' ');

/** El material: la idea tal como está, campo a campo. */
export function materialDeLaIdea({ titulo = '', descripcion = '', enlace = '' }) {
  const lineas = [`Título: ${titulo || 'sin título'}`];
  lineas.push(descripcion ? `Descripción: ${descripcion}` : 'Descripción: (vacía)');
  if (enlace) lineas.push(`Enlace: ${enlace}`);
  return lineas.join('\n');
}

/**
 * Lo que contesta, admitiendo solo lo pedido: sin título no hay mejora — un
 * título vacío borraría el que había, que es lo contrario de mejorar.
 */
export function leerMejora(texto) {
  const recorte = String(texto).slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  let datos = null;
  try { datos = JSON.parse(recorte); } catch { return null; }
  const titulo = String(datos?.titulo ?? '').trim();
  if (!titulo) return null;
  return {
    // El tope es holgado a propósito: el encargo pide menos de 40, pero un
    // título de 60 no rompe nada y cortarlo a media palabra sí se nota.
    titulo: titulo.slice(0, 120),
    descripcion: String(datos?.descripcion ?? '').trim().slice(0, 600),
  };
}

async function pedir({ clave, modelo, instruccion, material, buscar }) {
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': VERSION_API, 'content-type': 'application/json' },
    body: JSON.stringify({ model: modelo, max_tokens: 512, system: instruccion, messages: [{ role: 'user', content: material }] }),
  });

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message || `la API del modelo respondió ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

export async function pedirMejora({ clave, modelo, material, instruccion = INSTRUCCION_MEJORAR, buscar = fetch }) {
  return leerMejora(await pedir({ clave, modelo, instruccion, material, buscar }));
}
