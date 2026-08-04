/**
 * Una tanda de recados para el viaje: un emoji y una frase corta, con gracia.
 *
 * Es la opción **D2** de `docs/diseño/verano.html`, y la figura es la de
 * `sugerencias.js`: **una tanda de una vez**, porque lo caro de la llamada no es
 * el texto sino contarle al modelo el contexto. Doce frases cuestan lo mismo que
 * dos —350 fichas de salida contra 60, unas dos décimas de céntimo— así que el
 * número no lo decide el dinero: lo decide que a partir de quince el modelo se
 * repite.
 *
 * Dos decisiones que conviene que queden escritas:
 *
 * - **El material se compone aquí, no en el móvil.** El cliente manda el id del
 *   evento y nada más; dónde es, cuántos son, qué día del viaje va y qué se
 *   lleva apuntado sale de la base en este mismo Worker, así que nadie puede
 *   inyectarle nada desde un teléfono.
 * - **No viajan los nombres.** Al modelo le llega «nueve personas, seis adultas
 *   y tres niños», no quiénes son — la misma regla de §14.19-bis. Para escribir
 *   una broma sobre el hielo el nombre no aporta y es lo único de aquí que
 *   identifica a alguien.
 *
 * La tanda se guarda **en el servidor** con su hora (`repositorio.js`), y dentro
 * de la ventana de dos horas se devuelve la guardada sin llamar a nadie. Esa es
 * la diferencia entre doce llamadas al día por evento y doce **por móvil**: con
 * nueve teléfonos preguntando cada dos horas, la misma broma costaría nueve
 * veces y encima cada uno leería una cosa distinta.
 */

const ANTHROPIC = 'https://api.anthropic.com/v1';
const VERSION_API = '2023-06-01';
const TOPE_DE_SALIDA = 1024;

/** Cuántas se piden de una vez. Ver el porqué del número arriba. */
export const POR_TANDA = 12;

/** Cuánto vale una tanda antes de volver a pedirla. */
export const VENTANA_MS = 2 * 60 * 60 * 1000;

export const INSTRUCCION = [
  'Escribes los recadillos de una app que usa un grupo de amigos con niños en sus viajes.',
  'Te doy dónde están, cuántos son, por qué día del viaje van y qué llevan apuntado.',
  `Escribe exactamente ${POR_TANDA} frases distintas, en español de España, con guasa de cuadrilla:`,
  'cortas (menos de 70 caracteres), concretas de ese sitio y de esas fechas, y de cosas que pasan',
  'de verdad en un camping —el hielo, las chanclas, el calor, la siesta, la piscina, la sobremesa—.',
  'Nada de frases de galleta de la suerte ni de motivación. No te metas con nadie en particular',
  'ni des por hecho quién hace qué. No repitas la misma broma dos veces.',
  'Responde SOLO con un JSON: {"recados":[{"emoji":"🍉","texto":"…"}]}.',
  '«emoji» es un solo emoji y «texto» es la frase, sin comillas ni emoji dentro.',
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

/** Por qué día del viaje va, dicho como se dice. */
function porDondeVan(evento, hoy) {
  if (!evento?.startDate) return 'Sin fechas todavía.';
  if (hoy < evento.startDate) return `Todavía no ha empezado: sale el ${evento.startDate}.`;
  const fin = evento.endDate || evento.startDate;
  if (hoy > fin) return 'El viaje ya ha terminado.';
  const dia = Math.round((new Date(hoy) - new Date(evento.startDate)) / 86400000) + 1;
  const total = Math.round((new Date(fin) - new Date(evento.startDate)) / 86400000) + 1;
  return `Van por el día ${dia} de ${total}.`;
}

/** El material que se le manda, en las palabras con las que se lee. */
export function materialDelViaje({ evento, personas = [], hoy, cuentas = {} }) {
  const lineas = [
    `Sitio: ${evento?.lugar || 'sin decir'}`,
    `Cuándo: ${evento?.startDate || '?'} a ${evento?.endDate || evento?.startDate || '?'} (hoy es ${hoy})`,
    porDondeVan(evento, hoy),
    `Grupo: ${retratoDelGrupo(personas)}`,
  ];
  // Números, no nombres: cuánto se ha apuntado, cuántas cenas hay montadas, qué
  // falta por comprar y cuántos planes están sin decidir.
  const { gastos = 0, cenas = 0, planes = 0, compra = 0 } = cuentas;
  lineas.push(
    `Llevan apuntados ${gastos} gastos, ${cenas} cenas y ${planes} planes, y ${compra} cosas sin comprar.`,
  );
  return lineas.join('\n');
}

/** Del texto del modelo a la lista, sin fiarse de que venga limpio. */
export function leerRecados(texto) {
  const recorte = texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1);
  let datos;
  try {
    datos = JSON.parse(recorte);
  } catch {
    return [];
  }
  return (datos?.recados || [])
    .filter((r) => r && typeof r.texto === 'string' && r.texto.trim())
    .map((r) => ({
      // Un solo emoji: si el modelo se viene arriba y manda tres, se coge el
      // primero en vez de descuadrar la fila.
      emoji: [...String(r.emoji || '🐳').trim()][0] || '🐳',
      texto: String(r.texto).trim(),
    }))
    .slice(0, POR_TANDA);
}

/**
 * El encargo se puede reescribir desde Ajustes (`encargos.js`), así que llega de
 * fuera; sin nada guardado llega el de origen. La forma de la respuesta es parte
 * del encargo: si se reescribe perdiendo el JSON, `leerRecados` no encuentra
 * nada y la app se queda con las frases de los datos, que siguen saliendo.
 */
export async function pedirRecados({ clave, modelo, material, instruccion = INSTRUCCION, buscar = fetch }) {
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

  return leerRecados(texto);
}

/** ¿Sigue valiendo la tanda que hay guardada? */
export function sigueSirviendo(generadoEn, ahora = Date.now(), ventana = VENTANA_MS) {
  if (!generadoEn) return false;
  const t = Date.parse(generadoEn);
  return Number.isFinite(t) && ahora - t < ventana;
}
