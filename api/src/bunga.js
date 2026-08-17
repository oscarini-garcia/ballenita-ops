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
 *
 * Aquí vive además **el comentario que propone la ballena** (§14.66-quater), que
 * es lo contrario del resumen y por eso convive con él sin mezclarse: el resumen
 * lo escribe la app, se guarda con el sitio y sale solo; el comentario lo pide
 * una persona con un botón, no se guarda hasta que lo manda, y lo firma ella.
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
  return leerCampo(texto, 'resumen', TOPE_DEL_RESUMEN);
}

export async function pedirResumen({ clave, modelo, material, instruccion = INSTRUCCION, buscar = fetch }) {
  return llamar({ clave, modelo, material, instruccion, buscar, leer: leerResumen });
}

/* ── Un comentario para el hilo (§14.66-quater) ───────────────────────────── */

/**
 * Lo que cabe en un comentario escrito por el modelo. El tope de la tabla son
 * 2000 (`TOPE_DE_COMENTARIO` en `db.js`), pero eso es lo que aguanta la columna,
 * no lo que escribe nadie en un hilo: los del grupo son de un renglón.
 */
export const TOPE_DEL_COMENTARIO = 160;

/**
 * El encargo del botón «Que lo escriba la ballena».
 *
 * La orden de arriba —**hablar de cómo es el sitio**— es la que pidió esta
 * vuelta: sin ella salían comentarios que valen para cualquier bungalow del
 * camping («¡qué ganas ya!»), que es lo mismo que no escribir nada. Lo que
 * distingue este encargo del de la evaluación es a quién imita: la evaluación
 * la firma la app y por eso es llana, y esto lo va a mandar una persona con su
 * nombre, así que se escribe como se escribe en un chat.
 */
export const INSTRUCCION_COMENTARIO = [
  'Escribes UN comentario para el hilo de un bungalow de camping, en el chat de un grupo',
  'de amigos con niños que veranea junto desde hace años y se reparte las casas cada agosto.',
  'Te doy cómo es el sitio —la evaluación que tiene puesta, sus pegatinas y las notas de',
  'quienes han dormido ahí— y lo que ya se ha dicho en el hilo.',
  '**El comentario tiene que hablar de lo que dice cómo es el sitio**: la nevera, los bichos,',
  'la puerta que no cierra, lo que sea que ponga. Uno que valga para cualquier bungalow',
  '—«¡qué ganas ya!»— es lo mismo que no escribir nada.',
  `Una o dos frases, en español de España, de menos de ${TOPE_DEL_COMENTARIO} caracteres,`,
  'en tono de colega escribiendo en un chat: puede tener guasa, pero antes tiene que decir algo.',
  'Vale una pregunta al grupo, una pega, una propuesta o un aviso.',
  'No repitas lo que ya está dicho en el hilo ni lo que ya hayas propuesto antes.',
  'No nombres a nadie ni des por hecho quién duerme ahí, y no firmes.',
  'Responde SOLO con un JSON: {"comentario":"…"}.',
].join(' ');

/**
 * El material del comentario: lo del bunga **más la evaluación y el hilo**.
 *
 * La evaluación entra porque es justo lo que se pidió que tuviera en cuenta, y
 * el hilo porque un comentario que repite el de arriba se nota enseguida. Lo que
 * sigue sin viajar son los nombres: del hilo va **lo que se dijo**, nunca quién
 * lo dijo — la regla de §14.19-bis, y aquí además no hace falta para nada.
 */
export function materialDelComentario({ resumen = '', hilo = [], yaPropuestas = [], ...bunga } = {}) {
  const lineas = [materialDelBunga(bunga)];
  lineas.push(String(resumen).trim()
    ? `Cómo es, en una frase: ${String(resumen).trim()}`
    : 'Todavía no tiene ninguna evaluación escrita.');
  const dichos = hilo.map((t) => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-6);
  if (dichos.length) lineas.push(`Ya se ha dicho en el hilo:\n${dichos.map((t) => `- ${t}`).join('\n')}`);
  const antes = yaPropuestas.map((t) => String(t).trim()).filter(Boolean);
  if (antes.length) {
    lineas.push(`Ya has propuesto esto y no ha valido, escribe otro distinto:\n${antes.map((t) => `- ${t}`).join('\n')}`);
  }
  return lineas.join('\n');
}

export function leerComentario(texto) {
  return leerCampo(texto, 'comentario', TOPE_DEL_COMENTARIO);
}

export async function pedirComentario({ clave, modelo, material, instruccion = INSTRUCCION_COMENTARIO, buscar = fetch }) {
  return llamar({ clave, modelo, material, instruccion, buscar, leer: leerComentario });
}

/* ── La fontanería de los dos ─────────────────────────────────────────────── */

function leerCampo(texto, campo, tope) {
  const crudo = String(texto ?? '');
  const recorte = crudo.slice(crudo.indexOf('{'), crudo.lastIndexOf('}') + 1);
  let datos = null;
  try { datos = JSON.parse(recorte); } catch { return null; }
  const frase = String(datos?.[campo] ?? '').replace(/\s+/g, ' ').trim();
  // Un tope generoso al cortar: el encargo pide 180, y una de 200 se lee igual
  // de bien. Lo que no puede es venir un párrafo.
  return frase ? frase.slice(0, tope + 40) : null;
}

async function llamar({ clave, modelo, material, instruccion, buscar, leer }) {
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
  return leer((datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''));
}
