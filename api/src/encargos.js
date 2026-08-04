/**
 * Lo que se le pide al modelo, en un sitio y por escrito.
 *
 * La figura es la de `garciadoral-ops`: la clave y el modelo valen para todo lo
 * que la app haga con un modelo, y **debajo va el encargo de cada cosa, que se
 * puede reescribir desde Ajustes**. Allí son seis; aquí, de momento, uno.
 *
 * El motivo de que sean editables no es la curiosidad. Un encargo es donde se
 * sube o se baja el tono, donde se prohíbe lo que el modelo se suelta a decir y
 * donde se ajusta lo que no encaja con este grupo — y todo eso se descubre
 * **usándolo**, no escribiéndolo. Si vive en el código, cada retoque es una
 * versión nueva de la app y un OTA; aquí es escribir en una caja y guardar.
 *
 * Dos reglas que hay que respetar al reescribir uno:
 *
 * - **La forma de la respuesta es parte del encargo.** El de ideas pide un JSON
 *   con cinco propuestas y la app lo lee así (`leerPropuestas`): si al
 *   reescribirlo se pierde esa parte, deja de salir nada. Por eso la pista lo
 *   dice en la pantalla, y no solo aquí.
 * - **Vacío no es un encargo vacío, es volver al de origen.** Borrar la caja es
 *   la manera de deshacer, y tiene que estar siempre a mano: quien la ha liado
 *   reescribiéndolo no debería tener que pedirle a nadie el texto de antes.
 */

import { INSTRUCCION } from './sugerencias.js';
import { INSTRUCCION as CANTIDADES } from './cantidades.js';
import { INSTRUCCION_ARREGLAR, INSTRUCCION_PARECIDOS } from './receta.js';
import { INSTRUCCION_MEJORAR } from './idea.js';
import { INSTRUCCION as RECADOS, POR_TANDA } from './recados.js';

export const ENCARGOS = [
  {
    id: 'ideas',
    titulo: 'Proponer ideas de plan',
    pista: 'Se pide una tanda de cinco y la app espera un JSON con «que» y «porque»: si reescribes esto, conserva esa parte o dejará de salir nada. El sitio, las fechas, cuánta gente va y lo que ya hay apuntado se le dan aparte. Vacío, vuelve el encargo de origen.',
    origen: INSTRUCCION,
  },
  {
    id: 'cantidades',
    titulo: 'Poner las cantidades de una receta',
    pista: 'Se le da el plato, para cuántas raciones es y los ingredientes a los que les falta la cifra; contesta con la cantidad y con en qué se compra (el envase), que es lo que permite redondear. Espera un JSON con «nombre», «cantidad», «unidad» y «lote»: si reescribes esto, conserva esa parte. Estirar la receta para la gente que hay no lo hace el modelo, lo hace la app. Vacío, vuelve el encargo de origen.',
    origen: CANTIDADES,
  },
  {
    id: 'arreglar',
    titulo: 'Ordenar una lista de ingredientes escrita a saco',
    pista: 'Convierte «tres pinchos de wagyu» en 3 · ud · «Pinchos de wagyu». Es traducción, no invención: saca la cantidad y deja el nombre **como lo escribiste** —no corrige faltas ni cambia mayúsculas, porque también te cambiaría los nombres raros puestos a propósito—. Lo que ya trae número se respeta y lo que no se entiende —«al gusto»— se queda sin cantidad. Espera un JSON con «i», «cantidad», «unidad» y «nombre»; si le quitas esa parte, el botón deja de hacer nada. Vacío, vuelve el encargo de origen.',
    origen: INSTRUCCION_ARREGLAR,
    // Este encargo es traducción y no criterio: sacar «tres» de una frase no
    // pide el modelo grande, y es el botón que más se va a pulsar. Se puede
    // cambiar desde Ajustes como todo lo demás.
    modelo: 'claude-haiku-4-5',
  },
  {
    id: 'mejorarIdea',
    titulo: 'Mejorar la redacción de una idea',
    pista: 'El botón «Mejorarla» del editor de una idea: devuelve el título y la descripción mejor contados y con una coña ligera, sin inventar datos que no estén — el humor va en la forma, nunca en los datos. Espera un JSON con «titulo» y «descripcion»: si reescribes esto, conserva esa parte o el botón dejará de hacer nada. Lo que vuelve no se guarda solo: rellena el editor, se puede deshacer, y guardar sigue siendo el botón de siempre. Vacío, vuelve el encargo de origen.',
    origen: INSTRUCCION_MEJORAR,
    // Sonnet fijado a propósito: contar con gracia sí pide criterio —una coña
    // que no aterriza es peor que ninguna— y este botón se pulsa poco.
    modelo: 'claude-sonnet-4-5',
  },
  {
    id: 'parecidos',
    titulo: 'Proponer platos parecidos a uno',
    pista: 'Tanda de cinco a partir del plato abierto y de lo que ya hay en el catálogo. Cada propuesta llega entera —nombre, por qué, tipo e ingredientes con cantidades para 12— porque aceptarla abre el editor con todo puesto. Espera ese JSON: sin él no sale ninguna. Vacío, vuelve el encargo de origen.',
    origen: INSTRUCCION_PARECIDOS,
  },
  {
    id: 'recados',
    titulo: 'Escribir los recadillos del viaje',
    pista: `Las frases con emoji que salen al final de las listas y en las pantallas vacías. Se pide una tanda de ${POR_TANDA} y vale dos horas, así que son unas seis llamadas al día por evento y no una por frase. Espera un JSON con «emoji» y «texto»: si le quitas esa parte dejan de salir las de la IA, pero las que salen de los datos del viaje siguen apareciendo. Es donde se sube o se baja el tono. Vacío, vuelve el encargo de origen.`,
    origen: RECADOS,
    // Doce frases de camping no piden el modelo grande, y es lo que más veces
    // se pide del catálogo: una tanda cada dos horas mientras dura el viaje.
    modelo: 'claude-haiku-4-5',
  },
];

const PORid = new Map(ENCARGOS.map((e) => [e.id, e]));

/** La clave con la que se guarda en `configuracion`. */
export const claveDeEncargo = (id) => `encargo:${id}`;

/**
 * Y la del **modelo de ese encargo** (SPECS §14.16-quinquies).
 *
 * La clave es de la instalación, pero el modelo no tiene por qué: ordenar una
 * lista de ingredientes es traducción y le sobra el modelo grande; proponer
 * cinco platos que peguen con una paella, no. Sin nada guardado se usa el de
 * origen del encargo, y sin él, el general.
 */
export const claveDeModelo = (id) => `modelo:${id}`;

/** ¿Es uno de los nuestros? Lo que llega de un móvil no elige dónde se escribe. */
export const esEncargoConocido = (id) => PORid.has(id);

/**
 * Los encargos tal como quedan: lo guardado, o el de origen si no hay nada.
 *
 * `filas` es el mapa de la tabla `configuracion` que ya tiene
 * `leerConfiguracionIA`, para no volver a preguntarle a la base.
 */
export function encargosDe(filas) {
  return Object.fromEntries(
    ENCARGOS.map((e) => [e.id, filas.get(`ia.${claveDeEncargo(e.id)}`)?.valor || e.origen]),
  );
}

/**
 * Qué modelo usa cada encargo: el guardado, el de origen del encargo, o el
 * general. En ese orden, y el general es siempre la última palabra.
 */
export function modelosDe(filas, general) {
  return Object.fromEntries(
    ENCARGOS.map((e) => [e.id, filas.get(`ia.${claveDeModelo(e.id)}`)?.valor || e.modelo || general]),
  );
}

/** Lo que necesita la pantalla: el rótulo, la pista, el texto y si es el de origen. */
export function encargosPublicos(encargos = {}, modelos = {}, general = '') {
  return ENCARGOS.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    pista: e.pista,
    texto: encargos[e.id] ?? e.origen,
    esDeOrigen: (encargos[e.id] ?? e.origen) === e.origen,
    // El que se está usando de verdad, y si viene del de arriba o es suyo: la
    // pantalla necesita las dos cosas para poder ofrecer «el de arriba».
    modelo: modelos[e.id] ?? e.modelo ?? general,
    modeloPropio: modelos[e.id] !== general,
  }));
}
