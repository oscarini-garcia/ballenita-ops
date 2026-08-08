/**
 * Los estados de una persona: «🍺 de resaca», «🏖️ tirado en la toalla».
 *
 * Dos encargos que comparten módulo porque comparten forma —emoji y frase
 * corta— y se piden desde el mismo modal (`docs/diseño/estado.html` · I1 · I3):
 *
 * - **La tanda de cinco** (`INSTRUCCION_TANDA`), la figura de las ideas de plan
 *   y los recadillos: lo caro de la llamada no es el texto, es contarle al
 *   modelo el contexto, así que se piden cinco de una vez y se eligen tocando.
 * - **«Más gracioso»** (`INSTRUCCION_GRACIA`), la figura de «Mejorarla» de una
 *   idea: coges lo que has escrito y vuelve con más chispa, sin guardar nada —
 *   rellena el campo y se puede deshacer.
 *
 * Dos reglas que valen para los dos, como en todo lo demás (§14.19-bis):
 * **el material se compone aquí**, en el Worker, desde la base —el móvil manda
 * el id del evento y nada más—, y **no viajan los nombres**: para escribir «de
 * resaca» no hace falta saber quién lo está.
 *
 * Y una decisión que conviene que quede escrita: **la tanda no se guarda ni se
 * comparte**, al revés que los recadillos. Allí la broma es del viaje y que
 * todos lean la misma es lo bueno; aquí el estado es tuyo, y nueve personas
 * eligiendo de la misma lista acabarían con el mismo. Cinco frases con haiku
 * son calderilla y se piden cuando alguien las pide.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';

/** Cuántos se piden de una vez. Cinco es lo que cabe de un vistazo en el modal. */
export const POR_TANDA = 5;

const COMUNES = [
  'Escribes los estados de una app que usa un grupo de amigos con niños que veranea junto',
  'en un camping, con confianza de años y cachondeo de sobremesa.',
  'Un estado es lo que alguien pone para decir en qué anda: un emoji y una frase',
  'muy corta, en español de España, en minúscula y sin punto final.',
  'La frase va en primera persona o sin sujeto —«de resaca», «poniéndome crema»,',
  '«buscando la sombrilla»— y **nunca** nombra a nadie ni habla de otra persona.',
  'Humor de los que se dicen entre amigos, sin exclamaciones a puñados ni chistes de manual.',
].join(' ');

export const INSTRUCCION_TANDA = [
  COMUNES,
  `Te doy dónde están, qué día del viaje va y qué se lleva hecho. Devuelve ${POR_TANDA} estados`,
  'distintos entre sí y pegados a ese momento del viaje —el primer día no se está de vuelta—.',
  'Cada frase, de dos a cinco palabras.',
  'Responde SOLO con un JSON: {"estados":[{"emoji":"🍺","texto":"de resaca"}]}.',
].join(' ');

export const INSTRUCCION_GRACIA = [
  COMUNES,
  'Te doy el estado que alguien ha escrito y quiere con más gracia.',
  'Devuelve **el mismo estado** mejor contado: la misma idea, no otra.',
  'Puedes cambiar el emoji si hay uno que le pega más, y la frase se queda',
  'igual de corta —de dos a cinco palabras—. Si ya tiene gracia, cámbiala poco:',
  'con gracia no es más largo.',
  'Responde SOLO con un JSON: {"emoji":"🍺","texto":"de resaca"}.',
].join(' ');

/**
 * El material: dónde, qué día del viaje y qué se lleva apuntado. Ni un nombre.
 * Sin fechas —un evento puede no tenerlas— se dice así y el modelo escribe
 * estados de camping sin más.
 */
export function materialDeEstados({ evento, hoy, cuentas = {} }) {
  const lineas = [`Sitio: ${evento?.lugar || 'un camping'}`];
  if (evento?.startDate) {
    const dia = Math.round((new Date(`${hoy}T00:00:00`) - new Date(`${evento.startDate}T00:00:00`)) / 86400000) + 1;
    const total = evento.endDate
      ? Math.round((new Date(`${evento.endDate}T00:00:00`) - new Date(`${evento.startDate}T00:00:00`)) / 86400000) + 1
      : null;
    if (dia < 1) lineas.push('Cuándo: el viaje aún no ha empezado');
    else if (total && dia > total) lineas.push('Cuándo: el viaje ya terminó');
    else lineas.push(`Cuándo: día ${dia}${total ? ` de ${total}` : ''} del viaje`);
  } else {
    lineas.push('Cuándo: sin fechas puestas');
  }
  lineas.push(`Se lleva apuntado: ${cuentas.cenas ?? 0} cenas, ${cuentas.planes ?? 0} planes, ${cuentas.gastos ?? 0} gastos`);
  return lineas.join('\n');
}

/** El estado que ha escrito alguien, para pedirle gracia. */
export function materialDeUnEstado({ emoji = '', texto = '' }) {
  // Sin emoji no se cuela un espacio de más: lo que va al modelo se lee como
  // lo que es, no como un campo a medio rellenar.
  return `Estado: ${[emoji, texto].map((x) => String(x).trim()).filter(Boolean).join(' ')}`;
}

/** Un emoji de verdad y una frase corta, o nada. */
function limpiar(cruda) {
  const emoji = String(cruda?.emoji ?? '').trim().slice(0, 4);
  const texto = String(cruda?.texto ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!emoji || !texto) return null;
  return { emoji, texto };
}

export function leerEstados(texto) {
  const recorte = String(texto).slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  let datos = null;
  try { datos = JSON.parse(recorte); } catch { return []; }
  const lista = Array.isArray(datos?.estados) ? datos.estados : [];
  const vistos = new Set();
  const limpios = [];
  for (const cruda of lista) {
    const e = limpiar(cruda);
    // Dos frases iguales con emoji distinto son la misma propuesta dos veces, y
    // de cinco huecos eso deja cuatro.
    if (!e || vistos.has(e.texto.toLowerCase())) continue;
    vistos.add(e.texto.toLowerCase());
    limpios.push(e);
  }
  return limpios.slice(0, POR_TANDA);
}

export function leerUnEstado(texto) {
  const recorte = String(texto).slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  try { return limpiar(JSON.parse(recorte)); } catch { return null; }
}

async function pedir({ clave, modelo, instruccion, material, tope, buscar }) {
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': VERSION_API, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelo, max_tokens: tope, system: instruccion,
      messages: [{ role: 'user', content: material }],
    }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message || `la API del modelo respondió ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

export async function pedirEstados({ clave, modelo, material, instruccion = INSTRUCCION_TANDA, buscar = fetch }) {
  return leerEstados(await pedir({ clave, modelo, instruccion, material, tope: 512, buscar }));
}

export async function pedirGracia({ clave, modelo, material, instruccion = INSTRUCCION_GRACIA, buscar = fetch }) {
  return leerUnEstado(await pedir({ clave, modelo, instruccion, material, tope: 128, buscar }));
}
