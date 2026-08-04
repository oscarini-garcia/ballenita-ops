/**
 * Cinco planes propuestos para un viaje.
 *
 * La figura es la del regalo de `garciadoral-ops`: **una tanda de cinco de una
 * vez**, porque lo caro de la llamada no es el texto sino contarle al modelo el
 * contexto —una vez contado, pasar de una propuesta a otra no vuelve a pedir
 * nada—. Cada propuesta trae **qué** y **por qué**, que es lo que deja decidir
 * sin abrirla.
 *
 * Dos decisiones que conviene que queden escritas:
 *
 * - **El material se compone aquí, no en el móvil.** El cliente manda el id del
 *   evento y lo ya propuesto, y nada más. Lo que sabe el modelo —dónde es,
 *   cuándo, cuánta gente y de qué edades, y qué hay ya en el catálogo— sale de
 *   la base en este mismo Worker, así que nadie puede inyectarle nada desde un
 *   teléfono.
 * - **No viajan los nombres.** Al modelo le llega «seis personas, cuatro
 *   adultas y dos niños», no quiénes son. Para proponer una excursión el nombre
 *   no aporta y es lo único de aquí que identifica a alguien.
 */

import { renglonDeCocina } from './cocina.js';

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';
const TOPE_DE_SALIDA = 1024;

export const INSTRUCCION = [
  'Eres quien propone planes para un viaje de un grupo de amigos con niños.',
  'Te doy dónde es, cuándo, cuánta gente va y qué planes ya tienen apuntados.',
  'Propón exactamente cinco planes nuevos, en español de España, concretos y',
  'realizables en ese sitio y en esas fechas. No repitas ninguno de los que ya',
  'tienen. Nada de museos genéricos ni de «pasear por el centro»: algo que se',
  'pueda decidir hacer el jueves por la tarde.',
  'Responde SOLO con un JSON: {"propuestas":[{"que":"…","porque":"…"}]}.',
  '«que» es el nombre del plan, de menos de 40 caracteres. «porque» es una frase',
  'de menos de 120 caracteres que diga por qué encaja con este viaje.',
].join(' ');

/** Cuántos y de qué edad, sin decir quiénes. */
export function retratoDelGrupo(personas = []) {
  const adultos = personas.filter((p) => p.edad !== 'niño').length;
  const ninos = personas.length - adultos;
  if (!personas.length) return 'no se sabe cuánta gente va';
  const partes = [`${personas.length} personas`];
  if (adultos) partes.push(`${adultos} ${adultos === 1 ? 'adulta' : 'adultas'}`);
  if (ninos) partes.push(`${ninos} ${ninos === 1 ? 'niño' : 'niños'}`);
  return partes.join(', ');
}

/** El material que se le manda, en las palabras con las que se lee. */
export function materialDelViaje({ evento, personas, yaHay }) {
  const lineas = [
    `Sitio: ${evento?.lugar || 'sin decir'}`,
    `Fechas: ${evento?.startDate || '?'} a ${evento?.endDate || evento?.startDate || '?'}`,
    `Grupo: ${retratoDelGrupo(personas)}`,
    // Media hora de barbacoa es un plan, y sin saber que hay barbacoa no se
    // propone nunca (§14.20-quater).
    renglonDeCocina(evento),
  ];
  lineas.push(yaHay.length ? `Ya tienen apuntados: ${yaHay.join('; ')}` : 'Todavía no tienen ningún plan apuntado.');
  return lineas.join('\n');
}

/** Del texto del modelo a la lista, sin fiarse de que venga limpio. */
export function leerPropuestas(texto) {
  const recorte = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  let datos;
  try {
    datos = JSON.parse(recorte);
  } catch {
    return [];
  }
  return (datos?.propuestas || [])
    .filter((p) => p && typeof p.que === 'string' && p.que.trim())
    .map((p) => ({ que: String(p.que).trim(), porque: String(p.porque || '').trim() }))
    .slice(0, 5);
}

/**
 * El encargo se puede reescribir desde Ajustes (`encargos.js`), así que llega
 * de fuera; sin nada guardado llega el de origen. La forma de la respuesta es
 * parte del encargo: si se reescribe perdiendo el JSON, `leerPropuestas` no
 * encuentra nada y no sale ninguna idea. Por eso la pantalla lo avisa.
 */
export async function pedirPropuestas({ clave, modelo, material, instruccion = INSTRUCCION, buscar = fetch }) {
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

  return leerPropuestas(texto);
}
