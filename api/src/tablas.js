/**
 * Descripción de las tablas sincronizadas: qué columnas tiene cada una y cuáles
 * necesitan conversión al cruzar la frontera entre SQLite y JavaScript.
 *
 * Las columnas se llaman **igual que los campos del cliente** (`eventId`,
 * `amountCents`, `updatedAt`), en lugar de traducirse a `snake_case` como sería
 * costumbre en SQL. Es deliberado: el contrato de datos de la PWA ya existe y
 * está probado, y una capa de traducción entre dos juegos de nombres solo añade
 * una clase de error —el campo que se traduce mal en un sentido y no en el
 * otro— a cambio de nada.
 *
 * Tres tipos de campo necesitan cuidado:
 *
 * - `json`: objetos y listas que pertenecen a la fila y no se consultan por
 *   separado (los pagadores de un gasto, los votos de un plan). Viajan como
 *   texto JSON. No se normalizan en tablas aparte porque nadie pregunta nunca
 *   «qué gastos pagó esta familia» en SQL: eso lo calcula `lib/reparto.js` en
 *   el cliente, que es la regla de oro del proyecto.
 * - `booleanos`: SQLite no tiene tipo lógico y guarda 0 y 1. El cliente espera
 *   `true`/`false` de verdad, así que se convierten al leer.
 * - `numeros`: se declaran para documentar la intención del esquema.
 */

/** Columnas que comparten todas las tablas sincronizadas. */
export const COLUMNAS_COMUNES = ['updatedAt', 'creadoEn', 'borrado'];

export const TABLAS = {
  events: {
    columnas: ['name', 'lugar', 'currency', 'startDate', 'endDate', 'status', 'esDemo'],
    booleanos: ['esDemo'],
  },
  families: {
    columnas: ['eventId', 'name', 'color', 'avatar', 'estado'],
  },
  bungas: {
    columnas: ['eventId', 'name', 'alias', 'familyId'],
  },
  persons: {
    columnas: [
      'eventId', 'name', 'apodo', 'familyId', 'edad',
      'comeConMayores', 'cuentaComoAdultoReparto', 'pesoReparto', 'avatar', 'estado',
    ],
    booleanos: ['comeConMayores', 'cuentaComoAdultoReparto'],
  },
  expenses: {
    columnas: [
      'eventId', 'description', 'amountCents', 'currency', 'amountOriginal',
      'rate', 'category', 'dateISO', 'payers', 'participantIds',
    ],
    json: ['payers', 'participantIds'],
  },
  settlements: {
    columnas: ['eventId', 'dateISO', 'fromFamilyId', 'toFamilyId', 'amountCents'],
  },
  dishes: {
    // Catálogo compartido: es la única tabla que no cuelga de un evento… salvo
    // los platos del Demo, que llevan su `eventId` para no mezclarse con los de
    // verdad. Sin `eventId` el plato es de todos, que es el caso normal.
    columnas: ['name', 'categorias', 'esFavorito', 'ingredientes', 'eventId'],
    json: ['categorias', 'ingredientes'],
    booleanos: ['esFavorito'],
  },
  dinners: {
    columnas: ['eventId', 'dia', 'platoIds', 'bungaMayoresId', 'bungaNinosId', 'queSeHace', 'cantidades'],
    json: ['platoIds'],
  },
  planIdeas: {
    // El otro catálogo compartido, hermano de `dishes`: lo que se repite de un
    // viaje a otro. Ni día, ni estado, ni votos — esos son de cada agosto.
    // `eventId` nulo = de todos; con valor, solo del Demo (§14.9-quater).
    columnas: ['titulo', 'descripcion', 'ubicacion', 'enlace', 'costeEstimado', 'eventId'],
  },
  plans: {
    columnas: [
      'eventId', 'titulo', 'descripcion', 'dia', 'costeEstimado',
      'ubicacion', 'enlace', 'estado', 'votos', 'ideaId',
    ],
    json: ['votos'],
  },
  shop: {
    columnas: ['eventId', 'texto', 'categoria', 'comprado', 'compradoPor', 'compradoEn'],
    booleanos: ['comprado'],
  },
};

export const NOMBRES = Object.keys(TABLAS);

export const existeTabla = (nombre) => Object.prototype.hasOwnProperty.call(TABLAS, nombre);

/**
 * Convierte una fila de SQLite al objeto que espera el cliente: deshace el JSON
 * y devuelve los indicadores como booleanos. `borrado` no se transmite nunca —
 * el cliente recibe únicamente lo que sigue vivo.
 */
export function filaAObjeto(tabla, fila) {
  const { json = [], booleanos = [] } = TABLAS[tabla];
  const objeto = { ...fila };
  delete objeto.borrado;

  for (const campo of json) {
    if (objeto[campo] === null || objeto[campo] === undefined) {
      objeto[campo] = campo === 'votos' ? {} : [];
      continue;
    }
    try {
      objeto[campo] = JSON.parse(objeto[campo]);
    } catch {
      objeto[campo] = campo === 'votos' ? {} : [];
    }
  }

  for (const campo of booleanos) {
    if (objeto[campo] !== null && objeto[campo] !== undefined) {
      objeto[campo] = objeto[campo] === 1 || objeto[campo] === true;
    }
  }

  return objeto;
}

/**
 * Convierte los campos propuestos por un cliente en valores que SQLite admite,
 * descartando de paso cualquier clave que no sea columna de esa tabla. Es la
 * única puerta de entrada de datos ajenos al esquema.
 */
export function objetoAColumnas(tabla, campos) {
  const { columnas, json = [], booleanos = [] } = TABLAS[tabla];
  const salida = {};

  for (const [clave, valor] of Object.entries(campos)) {
    if (!columnas.includes(clave)) continue;

    if (json.includes(clave)) {
      salida[clave] = valor === null || valor === undefined ? null : JSON.stringify(valor);
    } else if (booleanos.includes(clave)) {
      salida[clave] = valor ? 1 : 0;
    } else if (valor === undefined) {
      salida[clave] = null;
    } else if (typeof valor === 'object' && valor !== null) {
      // Un objeto en una columna que no es JSON es un error del cliente; se
      // guarda su forma serializada antes que reventar la escritura entera.
      salida[clave] = JSON.stringify(valor);
    } else {
      salida[clave] = valor;
    }
  }

  return salida;
}
