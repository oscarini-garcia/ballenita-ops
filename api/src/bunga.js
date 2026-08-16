/**
 * El bunga, evaluado en dos frases (SPECS §14.66, §14.66-ter).
 *
 * Un bunga acumula **pegatinas** —«buena nevera», «bichos»— y unas **notas del
 * sitio** que crecen viaje a viaje: «la nevera congela mucho, bájala al 2», «el
 * segundo cuarto no tiene enchufe», «cuidado con la puerta corredera». Todo eso
 * vive dentro de su pantalla, así que la lista de bungas solo podía decir el
 * mote — y cuál es el bueno, que es la pregunta que se hace al repartirlos, no
 * lo contesta nadie sin abrir los seis.
 *
 * Esto pide **una evaluación redactada** que junte las dos cosas. Nació pidiendo
 * una coña (§14.66) y se corrigió a petición (§14.66-ter): la guasa ya está en
 * las notas que escribe la gente, y encima de ellas sobraba — lo que hace falta
 * al repartir los bungas es que alguien te diga **cómo es**, y para eso el chiste
 * estorba. Sin solemnidad tampoco: es una frase de alguien que ha dormido ahí,
 * no una ficha de agencia.
 *
 * Tres decisiones que conviene que queden escritas:
 *
 * - **El material lo manda el móvil**, al revés que los recadillos. Aquí no hay
 *   nada que componer desde la base: lo que se resume es exactamente lo que hay
 *   escrito en ese bunga, y es la misma figura que «Mejorar la redacción de una
 *   idea» o «Más gracioso» — el texto es tuyo y vuelve mejor contado.
 * - **No viajan los nombres.** Ni la familia que lo tiene ni quién escribió cada
 *   nota: la regla de §14.19-bis, y aquí además no aportan nada — se resume cómo
 *   es el sitio, no de quién es este agosto.
 * - **Se guarda con el sitio y no se pide sola.** El resumen se escribe en el
 *   alojamiento (`resumen`), que es del catálogo y no del evento, así que lo
 *   pide una persona y lo leen los nueve. Sin eso, nueve teléfonos abriendo la
 *   lista serían nueve llamadas de pago para leer nueve bromas distintas sobre
 *   la misma nevera.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';

/**
 * Lo que cabe en el renglón de debajo de la fila (§14.66-ter): dos líneas a lo
 * ancho de 390 pt. Eran 90 cuando la frase compartía renglón con el nombre y con
 * la pastilla de la familia; sola y abajo caben 180, que es lo que hace falta
 * para decir lo bueno **y** lo malo en vez de elegir uno.
 */
export const TOPE_DEL_RESUMEN = 180;

export const INSTRUCCION = [
  'Evalúas cómo es un bungalow de un camping, para un grupo de amigos con niños',
  'que veranea junto desde hace años y se reparte las casas cada agosto.',
  'Te doy sus pegatinas —lo que tiene bueno y malo— y las notas que han ido dejando',
  'los que han dormido ahí.',
  `Escribe una evaluación **redactada** de una o dos frases, en español de España,`,
  `de menos de ${TOPE_DEL_RESUMEN} caracteres, en tono normal y llano.`,
  'Lo que tiene que hacer es **decir cómo es el sitio**: lo bueno primero y lo malo después,',
  'concreto y con lo que de verdad pone en las notas — quien la lee está decidiendo',
  'si se queda con ese bungalow o con el de al lado.',
  'Ni chistes ni guasa: la gracia ya la ponen las notas, y encima de ellas estorba.',
  'Tampoco lenguaje de folleto ni de agencia inmobiliaria: nada de «acogedor», «ideal»',
  'ni «el mejor bungalow». Es lo que le contarías a un amigo que te pregunta qué tal está.',
  'No nombres a nadie ni des por hecho quién duerme ahí.',
  'Si no hay casi nada escrito, dilo —«apenas hay notas todavía»— en vez de inventarte cómo es.',
  'Responde SOLO con un JSON: {"resumen":"…"}.',
].join(' ');

/**
 * Lo que se le cuenta al modelo: las pegatinas en palabras y las notas tal cual.
 *
 * El nombre del bunga entra —«Bunga 12» no identifica a nadie y ayuda a que la
 * frase suene de ese sitio y no de un sitio cualquiera—; el mote también, que
 * suele ser la mitad del chiste ya hecho.
 */
export function materialDelBunga({ nombre = '', alias = '', notas = '', pegatinas = [] } = {}) {
  const lineas = [`Bungalow: ${String(nombre).trim() || 'sin nombre'}.`];
  if (String(alias).trim()) lineas.push(`Le llaman «${String(alias).trim()}».`);
  lineas.push(pegatinas.length
    ? `Pegatinas: ${pegatinas.join(', ')}.`
    : 'No tiene ninguna pegatina puesta.');
  lineas.push(String(notas).trim()
    ? `Notas de quienes han dormido ahí: ${String(notas).trim()}`
    : 'Nadie ha dejado ninguna nota todavía.');
  return lineas.join('\n');
}

export function leerResumen(texto) {
  const crudo = String(texto ?? '');
  const recorte = crudo.slice(crudo.indexOf('{'), crudo.lastIndexOf('}') + 1);
  let datos = null;
  try { datos = JSON.parse(recorte); } catch { return null; }
  const frase = String(datos?.resumen ?? '').replace(/\s+/g, ' ').trim();
  // Un tope generoso al cortar: el encargo pide 180, y una de 200 se lee igual
  // de bien. Lo que no puede es venir un párrafo.
  return frase ? frase.slice(0, TOPE_DEL_RESUMEN + 40) : null;
}

export async function pedirResumen({ clave, modelo, material, instruccion = INSTRUCCION, buscar = fetch }) {
  const respuesta = await buscar(`${ANTHROPIC}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': clave, 'anthropic-version': VERSION_API, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: modelo, max_tokens: 200, system: instruccion,
      messages: [{ role: 'user', content: material }],
    }),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message || `la API del modelo respondió ${respuesta.status}`);
    error.estado = respuesta.status;
    throw error;
  }
  return leerResumen((datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
}
