/**
 * Transporte contra la API propia (Worker + D1). Sustituye a `jsonbin.js`.
 *
 * La diferencia de fondo con el transporte anterior no es la URL: antes se
 * subía el documento **entero** del grupo y el merge ocurría en cada móvil;
 * ahora se sube una **cola de cambios** y se recibe la instantánea que el
 * servidor produce al aplicarla. El servidor es la autoridad, y por eso su
 * respuesta sustituye a la copia local en lugar de fusionarse con ella.
 */

import { cargarConfiguracion, estaConfigurada } from '../lib/config.js'
import { borrarSesion, haySesion, leerSesion } from '../auth/sesion.js'
import { isNative } from '../lib/native.js'
import { uid } from '../lib/ids.js'

const CLAVE_DISPOSITIVO = 'ballena.dispositivo'

/** Identificador estable de este móvil, para que el servidor sepa cuántos hay
 *  y cuándo sincronizó cada uno. No identifica a nadie por sí solo. */
function idDeDispositivo() {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO)
    if (!id) {
      id = uid('disp')
      localStorage.setItem(CLAVE_DISPOSITIVO, id)
    }
    return id
  } catch {
    return 'disp_efimero'
  }
}

/**
 * ¿Este dispositivo sincroniza con el grupo?
 *
 * La app de iOS, siempre; y el navegador **cuando hay sesión** (SPECS §14.61).
 *
 * Aquí ponía «solo la app de iOS», y el motivo era bueno: la única puerta era
 * Apple, que vive en la cáscara nativa, así que en el navegador no había forma
 * de tener una sesión y preguntar por la API era preguntar por algo que no
 * podía existir. Con el enlace de acceso sí la hay, y la regla se corrige por
 * donde estaba mal dicha: lo que decide no es dónde corre la app sino si tiene
 * con qué autenticarse.
 *
 * Sin sesión el navegador sigue siendo exactamente lo de antes —una libreta
 * local, y la demostración—, porque ni el modo local ni el Demo guardan sesión.
 */
export async function hayApi() {
  if (!isNative() && !haySesion()) return false
  return estaConfigurada(await cargarConfiguracion())
}

class SesionCaducada extends Error {
  constructor() {
    super('La sesión ha caducado. Vuelve a entrar con Apple.')
    this.sesionCaducada = true
  }
}

/**
 * Lo que se le da a la API para contestar antes de darla por perdida.
 *
 * **`fetch` no tiene plazo**, y esa es la frase entera: si la dirección de
 * `config.json` no responde —red de hotel, DNS, el Worker sin publicar— la
 * promesa no se cumple ni se rompe, se queda. Dentro de un `await` sin carrera,
 * eso es un botón girando para siempre, y desde el móvil «tarda» y «se ha
 * colgado» se ven exactamente igual. Es lo que dejaba «Pidiendo…» puesto en
 * Notificaciones: el permiso ya estaba dado y el identificador ya estaba pedido;
 * lo que no volvía era el `POST /api/push`.
 *
 * Veinte segundos son de sobra para cualquier respuesta de un Worker —incluida
 * la primera, con arranque en frío— y bastante menos que la paciencia de nadie.
 * Al agotarse **se dice con esas palabras**, que es lo que separa «la API no
 * contestó» de «la API contestó que no» (SPECS §14.9-bis).
 */
export const PLAZO_API = 20000

/** Un corte a los `PLAZO_API` ms, o nada si el motor no sabe hacerlos. */
function corte(ms = PLAZO_API) {
  try {
    return AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined
  } catch {
    return undefined
  }
}

async function peticion(camino, opciones = {}) {
  const configuracion = await cargarConfiguracion()
  if (!estaConfigurada(configuracion)) throw new Error('sin API configurada')

  const sesion = leerSesion()
  if (!sesion?.token) throw new SesionCaducada()

  let respuesta
  try {
    respuesta = await fetch(`${configuracion.api}${camino}`, {
      ...opciones,
      signal: opciones.signal ?? corte(),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sesion.token}`,
        'X-Dispositivo': idDeDispositivo(),
        'X-Plataforma': opciones.plataforma || 'web',
        ...(opciones.headers || {}),
      },
    })
  } catch (e) {
    // Un corte no es un fallo de la API: es que no hubo API. Se distingue por el
    // nombre del error, que es lo único que traen `TimeoutError` y `AbortError`.
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      const error = new Error(`la API no contestó en ${Math.round(PLAZO_API / 1000)} s (${camino})`)
      error.plazoAgotado = true
      throw error
    }
    throw e
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    // El token ya no vale (caducó, o la cuenta se desactivó). Se olvida aquí
    // mismo: dejarlo puesto haría que cada ciclo de sincronización repitiera
    // una petición que nunca va a funcionar.
    borrarSesion()
    throw new SesionCaducada()
  }

  if (!respuesta.ok) {
    // El estado HTTP viaja con el error, y con él lo que el servidor haya
    // explicado. Es lo que separa «la API contestó que no» de «la API no
    // contestó»: un 500 es un fallo suyo, un 404 una dirección equivocada, y no
    // tener número es que la petición no llegó a salir —red, DNS o certificado—.
    // Sin esto, la pantalla acababa diciendo «no se ha podido: error», que es la
    // misma palabra dos veces y no sirve para nada. Idea de `garciadoral-ops`.
    let datos = null
    try { datos = await respuesta.json() } catch { /* no era JSON: da igual */ }
    const explicacion = datos?.error || datos?.motivo
    const error = new Error(
      explicacion
        ? `la API respondió ${respuesta.status}: ${explicacion}`
        : `la API respondió ${respuesta.status}`,
    )
    error.estado = respuesta.status
    error.datos = datos
    throw error
  }
  return respuesta.json()
}

/** Instantánea completa del grupo. */
export const traerInstantanea = () => peticion('/api/sync')

/** Sube la cola y devuelve `{ resultados, instantanea }`. */
export const enviarCambios = (cambios) =>
  peticion('/api/cambios', { method: 'POST', body: JSON.stringify({ cambios }) })

/** Cuentas del grupo (solo para administradores). */
export const listarCuentas = () => peticion('/api/cuentas')

export const gestionarCuenta = (cuerpo) =>
  peticion('/api/cuentas', { method: 'POST', body: JSON.stringify(cuerpo) })

/** Apunta el token de APNs de este aparato, o lo silencia. */
export const registrarPush = (token, avisos = true) =>
  peticion('/api/push', { method: 'POST', body: JSON.stringify({ token, avisos }) })

/** Se manda un aviso a los aparatos de quien lo pide, y cuenta qué pasó. */
export const probarPush = () => peticion('/api/push/prueba', { method: 'POST' })

/**
 * De qué quiere enterarse esta cuenta (SPECS §14.39). Devuelve el **catálogo
 * entero** con lo que hay puesto, así que la pantalla no lleva su propia copia
 * de los nombres: una clase que se llame distinto en los dos sitios se apaga en
 * uno y sigue sonando en el otro.
 */
export const leerAvisos = () => peticion('/api/avisos')

export const guardarAvisos = (clases) =>
  peticion('/api/avisos', { method: 'POST', body: JSON.stringify({ clases }) })

/**
 * Qué migraciones conoce el código y cuáles le faltan a la base (solo para
 * administradores, SPECS §14.23). El POST aplica **la siguiente** y devuelve lo
 * que queda: se llama en bucle y así el progreso que se pinta es el de verdad.
 * Del móvil no viaja ninguna sentencia: el SQL vive dentro del Worker.
 */
export const leerMigraciones = () => peticion('/api/migraciones')

export const aplicarSiguienteMigracion = () =>
  peticion('/api/migraciones', { method: 'POST' })

/** Qué clave y qué modelo hay puestos. La clave nunca vuelve entera: solo sus
 *  cuatro últimos caracteres y cuándo se guardó. */
export const leerIA = () => peticion('/api/ia')

export const guardarIA = (cuerpo) =>
  peticion('/api/ia', { method: 'POST', body: JSON.stringify(cuerpo) })

/**
 * Elimina la cuenta propia (directriz 5.1.1(v) de la App Store).
 *
 * El código de Apple es opcional: sirve para que el Worker revoque además la
 * autorización ante Apple. Sin él la cuenta se elimina igual y la respuesta lo
 * dice en `revocado_en_apple`, que es lo que la pantalla enseña.
 */
/**
 * Una tanda de cinco planes propuestos para este viaje (SPECS §14.19).
 *
 * Del móvil sale el evento y lo ya visto en esta misma sesión, y nada más: el
 * material que lee el modelo lo compone el Worker con lo que hay en la base.
 * Cinco de una vez porque lo caro es contarle el contexto; pasar de una a otra
 * no vuelve a pedir nada.
 */
/**
 * Los modelos que la clave guardada puede usar, y si el par clave+modelo vale.
 *
 * Los dos preguntan al Worker y no a Anthropic: la clave vive allí y no vuelve
 * entera a ningún móvil (§14.16). Ver `api/src/ia.js`.
 */
export const listarModelosIA = () =>
  peticion('/api/ia/modelos').then((r) => ({
    modelos: r.modelos || [],
    // El que hay puesto **después** de comprobarlo: si el guardado ya no existe,
    // el Worker lo cambia por el más cercano y lo cuenta en `sustituto`.
    modelo: r.modelo || '',
    sustituto: r.sustituto || null,
  }))

export const probarIA = () => peticion('/api/ia/probar', { method: 'POST', body: '{}' })

/**
 * Las cantidades que le faltan a una receta (§14.20).
 *
 * Va el plato, para cuántos es y **solo los ingredientes sin cifra**. Quién come
 * no viaja: para decir cuánto arroz lleva una paella no aporta nada.
 */
export const cantidadesDePlato = ({ plato, raciones, ingredientes }) =>
  peticion('/api/plato/cantidades', {
    method: 'POST',
    body: JSON.stringify({ plato, raciones, ingredientes }),
  }).then((r) => r.cantidades || [])

/**
 * Ordena una lista de ingredientes escrita a saco (§14.20-bis).
 *
 * Va el plato y las líneas tal como están: «tres pinchos de wagyu» vuelve como
 * 3 · ud · «Pinchos de wagyu». Es traducción, no invención.
 */
export const arreglarIngredientes = ({ plato, raciones, lineas }) =>
  peticion('/api/plato/arreglar', {
    method: 'POST',
    body: JSON.stringify({ plato, raciones, lineas }),
  }).then((r) => r.lineas || [])

/**
 * La misma idea, mejor contada (§14.24).
 *
 * Van el título, la descripción y el enlace de esa idea; vuelve la propuesta
 * del modelo, que rellena el editor **sin guardar nada**: hay deshacer, y
 * guardar sigue siendo el botón de siempre.
 */
export const mejorarIdea = ({ titulo, descripcion, enlace }) =>
  peticion('/api/idea/mejorar', {
    method: 'POST',
    body: JSON.stringify({ titulo, descripcion, enlace }),
  }).then((r) => r.idea || null)

/**
 * Cinco estados para ponerse (§14.36 · I1).
 *
 * Solo se llama al pulsar «Otras cinco»: pedirlos al abrir el modal sería
 * gastar la credencial de pago sin que nadie lo haya pedido. Sin clave puesta
 * el Worker contesta la lista vacía con `sinClave`, y el botón no se enseña.
 */
export const estadosSugeridos = ({ eventId, hoy }) =>
  peticion('/api/estados/sugerir', {
    method: 'POST',
    body: JSON.stringify({ eventId, hoy }),
  }).then((r) => r.estados || [])

/**
 * El estado que has escrito, con más gracia (§14.36 · I3).
 *
 * La figura de «Mejorarla» de una idea: lo que vuelve **rellena el campo** y no
 * guarda nada — se puede deshacer y Guardar sigue siendo el botón de siempre.
 */
export const estadoConGracia = ({ emoji, texto }) =>
  peticion('/api/estados/gracia', {
    method: 'POST',
    body: JSON.stringify({ emoji, texto }),
  }).then((r) => r.estado || null)

/**
 * Cinco platos que peguen con este, para ir adelante y atrás (§14.20-bis).
 *
 * Tanda de cinco, como los regalos de `garciadoral-ops`: lo caro es contarle el
 * contexto, y pasar de una propuesta a otra no vuelve a pedir nada.
 */
export const platosParecidos = ({ plato, ingredientes, yaHay, eventId }) =>
  peticion('/api/plato/parecidos', {
    method: 'POST',
    // Va el id del evento y no lo que se cocina en él: el material lo compone el
    // Worker leyendo la base (§14.20-quater), como el resto.
    body: JSON.stringify({ plato, ingredientes, yaHay, eventId }),
  }).then((r) => r.platos || [])

export const sugerirPlanes = (eventId, descartadas = []) =>
  peticion('/api/plan/sugerir', {
    method: 'POST',
    body: JSON.stringify({ eventId, descartadas }),
  }).then((r) => r.propuestas || [])

/**
 * La tanda de recadillos del viaje (SPECS §14.25).
 *
 * Devuelve lo que el servidor tenga: la tanda guardada si sigue dentro de su
 * ventana de dos horas, una nueva si no. Sin clave de IA contesta la lista
 * vacía y **no es un error** — las frases que salen de los datos del viaje se
 * calculan en el móvil y siguen apareciendo igual.
 */
export const traerRecados = (eventId, hoy) =>
  peticion('/api/recados', {
    method: 'POST',
    body: JSON.stringify({ eventId, hoy }),
  }).then((r) => ({ recados: r.recados || [], generadoEn: r.generadoEn || null }))

export const eliminarMiCuenta = (codigoApple = null) =>
  peticion('/api/cuenta/baja', {
    method: 'POST',
    plataforma: 'ios',
    body: JSON.stringify({ codigo_apple: codigoApple }),
  })
