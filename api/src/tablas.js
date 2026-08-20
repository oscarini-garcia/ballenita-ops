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
    // `cocina` es con qué se cocina en este viaje, y solo se lee al componer el
    // material de la IA (§14.20-quater). Texto libre, y vacío vale el de origen.
    columnas: ['name', 'lugar', 'currency', 'startDate', 'endDate', 'status', 'esDemo', 'cocina'],
    booleanos: ['esDemo'],
  },
  families: {
    // `alias` son las dos letras que firman una idea —«GA»— y que caben donde
    // no cabe «García» (`docs/diseño/planes-ideas.html` · B3 · D3).
    //
    // **`estado` se retiró en §14.66** y por eso no está aquí: quien dice en qué
    // anda es cada persona, y dos estados encima del mismo grupo se contradicen
    // sin que nadie los actualice. La columna sigue en la base —no se tira una
    // columna para no escribirla— y deja de viajar, que es lo que importa.
    columnas: ['eventId', 'name', 'alias', 'color', 'avatar'],
  },
  bungas: {
    // `alojamientoId` apunta al catálogo (§14.56): es lo que hace que el
    // «Bunga 12» de 2025 y el de 2026 sean el mismo sitio y puedan tener notas
    // e histórico. Nulo = un bunga suelto de este viaje, que es lo que eran
    // todos hasta ahora.
    columnas: ['eventId', 'name', 'alias', 'familyId', 'alojamientoId'],
  },
  persons: {
    columnas: [
      'eventId', 'name', 'apodo', 'familyId', 'edad',
      'comeConMayores', 'cuentaComoAdultoReparto', 'pesoReparto', 'avatar', 'estado',
      // Quien se ha ido unos días (0023). Nulo = está, para que las filas de
      // antes queden bien sin tocarlas.
      'ausente',
      // Cuándo se puso el estado (0013). No vale `updatedAt`: esa se mueve con
      // cualquier cambio de la persona, y la tira de «Hoy» se ordena por lo
      // nuevo de **el estado**, no por lo último que alguien tocó de su ficha.
      'estadoEl',
      // Quién se entera de **todos** los gastos, le toquen o no (§14.58). No es
      // un rasgo de la persona sino un encargo, y por eso lo pone quien
      // administra y no se hereda de la edad.
      'llevaLasCuentas',
    ],
    booleanos: ['comeConMayores', 'cuentaComoAdultoReparto', 'llevaLasCuentas'],
  },
  expenses: {
    // `reparto` es cómo se divide el gasto cuando no basta con «quién entra»
    // (§14.26): `{ modo: 'partes' | 'importes', porFamilia: {...} }`. Nulo —que
    // es lo que llevan los gastos de siempre— significa reparto por pesos, así
    // que un cliente que no lo entienda sigue leyendo el gasto y sacando la
    // cuenta de antes. Los importes van en **céntimos enteros**, como todo el
    // dinero de la casa: un porcentaje guardado obligaría a redondear en cada
    // lectura y dos móviles con el mismo hecho podrían pintar saldos distintos.
    columnas: [
      'eventId', 'description', 'amountCents', 'currency', 'amountOriginal',
      'rate', 'category', 'dateISO', 'payers', 'participantIds', 'reparto',
    ],
    json: ['payers', 'participantIds', 'reparto'],
  },
  settlements: {
    columnas: ['eventId', 'dateISO', 'fromFamilyId', 'toFamilyId', 'amountCents'],
  },
  dishes: {
    // Catálogo compartido: es la única tabla que no cuelga de un evento… salvo
    // los platos del Demo, que llevan su `eventId` para no mezclarse con los de
    // verdad. Sin `eventId` el plato es de todos, que es el caso normal.
    // `raciones` es para cuántos es la receta (§14.20): sin ese denominador una
    // cantidad no se puede estirar ni repartir entre las dos mesas.
    // `receta` es **cómo se hace**, en texto libre (§14.64). Es lo otro que hace
    // falta saber de un plato: de `ingredientes` sale la lista de la compra, y
    // de esto sale lo que se lee delante del fuego.
    columnas: ['name', 'categorias', 'esFavorito', 'ingredientes', 'raciones', 'receta', 'eventId'],
    json: ['categorias', 'ingredientes'],
    booleanos: ['esFavorito'],
  },
  dinners: {
    // `platoIdsNinos` en NULL quiere decir «los niños comen lo mismo» (§14.20).
    // `fuera` en 1 es que esa noche se cena fuera y `donde` es el sitio, texto
    // libre y vacío legítimo —se sabe que se sale y no dónde— (§14.70).
    columnas: ['eventId', 'dia', 'platoIds', 'platoIdsNinos', 'bungaMayoresId', 'bungaNinosId', 'fuera', 'donde', 'queSeHace', 'cantidades'],
    json: ['platoIds', 'platoIdsNinos'],
  },
  planIdeas: {
    // El otro catálogo compartido, hermano de `dishes`: lo que se repite de un
    // viaje a otro. Ni día, ni estado, ni votos — esos son de cada agosto.
    // `eventId` nulo = de todos; con valor, solo del Demo (§14.9-quater).
    // `apuntadaEl` la escribe el cliente al crear, y no se usa `creadoEn`: esa
    // la pone el Worker y no existe hasta sincronizar (§14.19-ter).
    columnas: ['titulo', 'descripcion', 'enlace', 'creadaPor', 'apuntadaEl', 'eventId'],
  },
  plans: {
    // `hora` («20:00», local) y `cuando` (el mismo momento en epoch) los escribe
    // **el móvil**, que es quien sabe su desfase (§14.73). `avisadoEl` **no está
    // aquí a propósito**: lo pone el cron al mandar el recordatorio, y dejarlo
    // fuera es lo que impide que un cliente lo borre y desate doce avisos.
    columnas: [
      'eventId', 'titulo', 'descripcion', 'dia', 'costeEstimado',
      'ubicacion', 'enlace', 'estado', 'votos', 'ideaId', 'propuestoEl',
      'hora', 'cuando',
    ],
    json: ['votos'],
  },
  shop: {
    // `familyId` nulo = línea común, que es como nacen todas las de siempre y
    // todas las que calculan las cenas (§14.54).
    columnas: ['eventId', 'texto', 'categoria', 'comprado', 'compradoPor', 'compradoEn',
      'origen', 'clave', 'cantidad', 'unidad', 'desglose', 'cambio', 'familyId'],
    json: ['desglose', 'cambio'],
    booleanos: ['comprado'],
  },
  mejoras: {
    // El roadmap de la app, apuntado desde el móvil (§14.22, figura del bloque
    // «Mejoras» de garciadoral-ops). `hecho` va sin quién ni cuándo: es una
    // lista de la compra, no un registro de trabajo. `autorId` es una persona
    // del grupo; `apuntadaEl` la escribe el cliente (§14.19-ter); `eventId`
    // nulo = de todos, con valor = solo del Demo (§14.9-quater).
    columnas: ['texto', 'hecho', 'autorId', 'apuntadaEl', 'eventId'],
    booleanos: ['hecho'],
  },
  registro: {
    // La bitácora del viaje: qué ha hecho cada uno, para el recap del final
    // (§14.50). `texto` viaja **ya compuesto** por el móvil que lo hizo, y no se
    // rehace aquí: la frase depende de cómo estaba la fila en ese momento, y una
    // cena borrada en octubre no puede volver a decir de qué día era.
    // `tabla` + `filaId` son solo para juntar lo repetido; el recap no los mira.
    columnas: ['eventId', 'personId', 'tabla', 'filaId', 'accion', 'clase', 'texto', 'cuando'],
  },
  trucos: {
    // Lo que hay que acordarse de un viaje a otro (§14.53). Catálogo compartido
    // como `dishes` y `planIdeas`: `eventId` nulo = de todos, con valor = solo
    // del Demo. **No lleva `hecho`**: un truco no es una tarea que se tacha,
    // es algo que sigue siendo verdad el año que viene.
    columnas: ['texto', 'categoria', 'autorId', 'apuntadoEl', 'eventId'],
  },
  comentarios: {
    // El hilo de cualquier cosa (§14.55). `ancla` es `'<tipo>:<id>'` —`plan:abc`,
    // `gasto:def`, `dia:2026-08-15`— y es lo que permite que la misma tabla
    // sirva en las ocho pantallas donde un comentario pide salir, en vez de una
    // columna JSON por tabla que además haría que dos personas comentando a la
    // vez se pisaran la fila entera.
    columnas: ['eventId', 'ancla', 'texto', 'autorId', 'escritoEl'],
  },
  alojamientos: {
    // El catálogo que hace que un bunga tenga historia (§14.56). Aquí vive lo
    // que **no cambia de un año a otro** —cómo es el sitio—; qué familia lo
    // tiene es del bunga del evento.
    // `resumen` es la frase con guasa que sale en la lista, y `resumenDe` la
    // huella de las notas con que se escribió: sin ella, un resumen que ya no
    // dice la verdad se ve igual que uno recién hecho (§14.66).
    columnas: ['name', 'notas', 'pegatinas', 'resumen', 'resumenDe', 'eventId'],
    json: ['pegatinas'],
  },
  cacharros: {
    // El que trae cada familia, y quién vota cuál (§14.57). `votos` es el mismo
    // mapa persona → valor que en `plans`, y por eso no hay maquinaria nueva.
    columnas: ['eventId', 'familyId', 'texto', 'votos', 'apuntadoEl'],
    json: ['votos'],
  },
};

/**
 * Qué es «vacío» para cada campo JSON, que no siempre es una lista.
 *
 * Los votos de un plan vacíos son `{}` y no `[]`, y el `reparto` de un gasto
 * vacío es **nulo**: null ahí significa «por pesos, como siempre», que es un
 * valor con sentido y no la ausencia de uno. Devolver `[]` lo dejaría en un
 * objeto sin `modo`, que funciona por accidente y no por diseño.
 */
const VACIO_JSON = { votos: {}, reparto: null };

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
    const vacio = campo in VACIO_JSON ? VACIO_JSON[campo] : [];
    if (objeto[campo] === null || objeto[campo] === undefined) {
      objeto[campo] = vacio;
      continue;
    }
    try {
      objeto[campo] = JSON.parse(objeto[campo]);
    } catch {
      objeto[campo] = vacio;
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
