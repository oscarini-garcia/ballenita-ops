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

export const ENCARGOS = [
  {
    id: 'ideas',
    titulo: 'Proponer ideas de plan',
    pista: 'Se pide una tanda de cinco y la app espera un JSON con «que» y «porque»: si reescribes esto, conserva esa parte o dejará de salir nada. El sitio, las fechas, cuánta gente va y lo que ya hay apuntado se le dan aparte. Vacío, vuelve el encargo de origen.',
    origen: INSTRUCCION,
  },
];

const PORid = new Map(ENCARGOS.map((e) => [e.id, e]));

/** La clave con la que se guarda en `configuracion`. */
export const claveDeEncargo = (id) => `encargo:${id}`;

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

/** Lo que necesita la pantalla: el rótulo, la pista, el texto y si es el de origen. */
export function encargosPublicos(encargos = {}) {
  return ENCARGOS.map((e) => ({
    id: e.id,
    titulo: e.titulo,
    pista: e.pista,
    texto: encargos[e.id] ?? e.origen,
    esDeOrigen: (encargos[e.id] ?? e.origen) === e.origen,
  }));
}
