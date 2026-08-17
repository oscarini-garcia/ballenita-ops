/**
 * Los días de un evento, y qué se hace en cada uno.
 *
 * Vive aparte de las pantallas porque lo usan las dos áreas de Agenda —«Hoy» y
 * «Días»— y porque es justo la clase de cosa que conviene poder probar sin
 * montar React: fechas, plurales y el caso de «hoy no cae dentro del viaje».
 *
 * Ver `docs/diseño/navegacion.html` · B2 (Hoy · Días), E1 (qué enseña Hoy),
 * F3 (qué enseña cuando hoy no es del evento) y G1 (una fila por día).
 */
import { porOrdenDeCarta } from './carta.js'

/**
 * Un día en AAAA-MM-DD **desde la fecha local**, y nunca por `toISOString()`.
 *
 * `toISOString()` convierte a UTC, y en España eso es dos horas atrás en verano:
 * la medianoche del 8 de agosto es el 7 a las 22:00Z, así que el calendario de
 * un viaje que empieza el 8 salía empezando el 7 y la cena del primer día
 * aparecía el día de antes. En el contenedor de las pruebas —que va en UTC— no
 * se veía; en el móvil de cualquiera del grupo, sí.
 */
export const isoLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const hoyISO = () => isoLocal(new Date())

/**
 * Todos los días del evento, del primero al último, **incluidos los vacíos**.
 *
 * Antes la agenda saltaba los días sin nada (`if (!cena && !planes) return null`)
 * y un viaje de ocho días con cosas en tres enseñaba tres filas. El día vacío es
 * justo el que hay que poder tocar para llenarlo, así que sale igual que los otros.
 *
 * Sin fechas en el evento no hay calendario que valga: se cae a los días que
 * alguien haya apuntado, ordenados.
 */
export function diasDe(event, apuntados = []) {
  const dias = []
  if (event?.startDate) {
    const d = new Date(event.startDate + 'T00:00:00')
    const ultimo = new Date((event.endDate || event.startDate) + 'T00:00:00')
    // El tope de 60 es un seguro contra una fecha final disparatada: un evento
    // de dos meses no existe, y un bucle infinito cuelga la pestaña.
    let guarda = 0
    while (d <= ultimo && guarda++ < 60) {
      dias.push(isoLocal(d))
      d.setDate(d.getDate() + 1)
    }
    return dias
  }
  return [...new Set(apuntados.filter(Boolean))].sort()
}

const LARGO = { weekday: 'long', day: 'numeric', month: 'long' }
const CORTO = { weekday: 'short', day: 'numeric', month: 'short' }

export const fmtDiaLargo = (dia) => new Date(dia + 'T00:00:00').toLocaleDateString('es-ES', LARGO)
export const fmtDiaCorto = (dia) => new Date(dia + 'T00:00:00').toLocaleDateString('es-ES', CORTO)

/** El número y las tres letras del día, para la casilla de la izquierda de una fila. */
export function numeroYDia(dia) {
  const d = new Date(dia + 'T00:00:00')
  return {
    numero: String(d.getDate()),
    semana: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').slice(0, 3),
  }
}

/** Días enteros entre dos fechas ISO. Positivo si `b` es posterior a `a`. */
export function diasEntre(a, b) {
  const ms = new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')
  return Math.round(ms / 86400000)
}

/**
 * El plato que da nombre a una cena: el principal si lo hay, y si no el primero.
 * Una cena de seis platos se anuncia por la paella, no por las aceitunas.
 */
export function platoQueManda(platos = []) {
  return platos.find((p) => p?.categorias?.includes('principal')) ?? platos[0] ?? null
}

/**
 * Cuántas letras entran en el titular de una fila antes de que recorte
 * (`docs/diseño/dia-titular.html`).
 *
 * La línea mide **289 pt** y lleva `white-space: nowrap`, así que lo que sobra
 * no baja: se come. Medido con contenido real: «Bici electrica a Cadaques» son
 * 25 letras y 253,1 pt —entra—, y «Cena en la playa con música!» son 28 y
 * 293,4 —no entra, y hoy se ve recortada en la app—. De ahí el tope: **26**, la
 * última medida que cabe con holgura en Grande.
 *
 * Es un número aproximado a propósito. La alternativa era medir el texto de
 * verdad, y eso necesita el navegador dentro de una función que hoy es pura y
 * corre en las pruebas sin montar nada.
 */
export const LETRAS_DEL_TITULAR = 26

/**
 * Cómo se nombra una noche que se cena fuera (§14.70).
 *
 * Vive aquí y no repetido en cada pantalla porque lo dicen **cuatro** —la lista
 * de Días, el renglón del día, «Hoy» y la capa en lectura—, y una frase escrita
 * cuatro veces es un desfase esperando a pasar. Sin sitio no se inventa nada:
 * «Se cena fuera» ya es la noticia, y es legítimo saberlo antes que el dónde.
 */
export function titularDeFuera(cena) {
  const donde = (cena?.donde ?? '').trim()
  return donde ? `Fuera · ${donde}` : 'Se cena fuera'
}

/**
 * El titular de una cena en la lista de días: **los principales**
 * (`docs/diseño/dia-titular.html` · P4).
 *
 * Antes mandaba **uno solo** (`platoQueManda`), así que una Noche Ibérica de
 * jamón y tortilla se anunciaba por el jamón y la tortilla no salía en ninguna
 * pantalla sin abrir el día.
 *
 * Tres reglas, y las tres son por lo mismo —que la línea no parte—:
 *
 *   · **solo los principales**, que es lo que se pidió: el aperitivo y el postre
 *     acompañan, no titulan;
 *   · **dos como tope**, y del tercero en adelante «y N más». Tres nombres
 *     propios no caben en 289 pt ni encadenando los cortos;
 *   · y si los dos juntos **se pasan de `LETRAS_DEL_TITULAR`**, se cae al
 *     primero y se cuenta el resto: «Pinchos Arnall 🍖 y Tortilla de patata»
 *     mide 370,7 pt y saldría cortada por la mitad, que es peor que contar.
 *
 * Sin ningún principal se queda la regla de antes —el primer plato—: nombrar dos
 * acompañamientos como titular de la noche dice menos que nombrar uno.
 */
export function titularDePlatos(platos = []) {
  const principales = platos.filter((p) => p?.categorias?.includes('principal'))
  if (principales.length === 0) return platoQueManda(platos)?.name ?? null

  const nombres = principales.map((p) => p.name)
  const dos = juntarYContar(nombres, Math.min(2, nombres.length))
  return dos.length <= LETRAS_DEL_TITULAR || nombres.length === 1 ? dos : juntarYContar(nombres, 1)
}

/**
 * Cómo se resume un día en una fila: un titular y una línea de debajo.
 *
 * El titular dice **lo que se hace** —la cena si la hay, y si no el primer plan—
 * y la línea de debajo cuenta lo que hay, que es lo que sirve para comparar días
 * de un vistazo. Un día sin nada no se calla: dice que está libre.
 */
export function resumenDeDia({ cena, planes = [], platos = [], bungaMayores, esPrimero, esUltimo }) {
  const nPlatos = cena?.platoIds?.length ?? 0
  const nPlanes = planes.length

  let titulo
  if (cena?.fuera) {
    // Se cena fuera: eso **es** el titular del día, con o sin sitio. Antes esto
    // se apuntaba como plan y el día decía «sin cena» teniendo la cena decidida.
    titulo = titularDeFuera(cena)
  } else if (cena) {
    // El plato manda y **la bunga no entra en el titular**: la hoja de opciones
    // lo dibujaba como «Paella mixta en El del ruido», y puesto en la app real
    // eso son 268 pt en una fila que tiene 237 con el lápiz — se recortaba en
    // «Paella mixta en El del…». Dónde se cena vive en el titular de «Hoy» y en
    // el modal del día, que es donde hay sitio; aquí solo cuando no hay plato
    // que enseñar y el titular se quedaría en un «Cena» pelado.
    titulo = titularDePlatos(platos) ?? (bungaMayores ? `Cena en ${bungaMayores}` : 'Cena')
  } else if (nPlanes > 0) {
    titulo = planes[0].titulo
  } else if (esPrimero) {
    titulo = 'Llegada'
  } else if (esUltimo) {
    titulo = 'Vuelta a casa'
  } else {
    titulo = 'Día libre'
  }

  if (!cena && nPlanes === 0) return { titulo, detalle: 'nada apuntado' }

  // **El renglón nombra en vez de contar** (`dia-titular.html` · N1 · C1). Decía
  // «sin cena · 2 planes», y para saber cuál era el segundo plan había que abrir
  // el día: el titular solo enseña el primero. Contar sirve para comparar días;
  // nombrar sirve para saber qué hay, que es a lo que se entra aquí.
  //
  // Se nombra **lo que no esté ya arriba**: con cena titulan los platos y bajan
  // todos los planes; sin cena titula el primer plan y bajan los demás. Repetir
  // el titular en su propio renglón es gastar la única línea que queda.
  const planesAbajo = cena ? planes : planes.slice(1)
  const trozos = []
  if (planesAbajo.length) {
    trozos.push(enumerarConTope(planesAbajo.map((p) => p.titulo).filter(Boolean), LETRAS_DEL_RENGLON))
  } else if (nPlanes === 0) {
    // Que un día no tenga nada que hacer es un dato, y es el que se busca al
    // repasar el viaje. Sin cena no se dice: ahí el titular ya es el plan.
    trozos.push('sin planes')
  }
  if (!cena) trozos.push('sin cena')
  // Con cena fuera no falta nada que apuntar: los platos son cosa de quien
  // cocina, y esa noche no cocina nadie.
  else if (nPlatos === 0 && !cena.fuera) trozos.push('cena sin platos')

  return { titulo, detalle: trozos.filter(Boolean).join(' · ') }
}

/**
 * Qué día enseña «Hoy» y cómo se rotula (opción F3).
 *
 * Un evento dura ocho días y la app se abre los otros trescientos cincuenta y
 * siete también. Antes, esos días la pantalla decía «la agenda está vacía, añade
 * cenas y planes», que es mentira —hay ocho días apuntados— y hace que alguien
 * vuelva a apuntar lo que ya estaba. Ahora enseña el día más próximo diciendo
 * lo que es: el primero que viene, o el último que fue.
 */
export function diaQueEnsenaHoy(dias, hoy = hoyISO()) {
  if (dias.length === 0) return null
  if (dias.includes(hoy)) return { dia: hoy, estado: 'hoy', distancia: 0 }
  const primero = dias[0]
  const ultimo = dias[dias.length - 1]
  if (hoy < primero) return { dia: primero, estado: 'antes', distancia: diasEntre(hoy, primero) }
  return { dia: ultimo, estado: 'despues', distancia: diasEntre(ultimo, hoy) }
}

/** El rótulo del titular: «Domingo 9 · esta noche», «Sábado 8 · dentro de 6 días». */
export function rotuloDelDia({ dia, estado, distancia }, { hayCena = false } = {}) {
  const fecha = fmtDiaCorto(dia)
  if (estado === 'hoy') return `${fecha} · ${hayCena ? 'esta noche' : 'hoy'}`
  if (estado === 'antes') {
    const cuando = distancia === 1 ? 'mañana' : `dentro de ${distancia} días`
    return `${fecha} · el primer día, ${cuando}`
  }
  const cuando = distancia === 1 ? 'fue ayer' : `hace ${distancia} días`
  return `${fecha} · el último día, ${cuando}`
}

/**
 * El titular de la cena en el renglón del día: **los principales**.
 *
 * Decía «Paella mixta y cinco cosas más», con el mismo defecto que la lista de
 * Días: nombraba **uno** y contaba el resto, así que la tortilla de una Noche
 * Ibérica no salía en ninguna pantalla sin abrir el elegidor. Pasa a
 * `titularDePlatos` (§14.69 · P4) por lo mismo y con las mismas reglas: dos como
 * tope y el resto contado.
 *
 * **Y el recuento se va del titular** porque el renglón de debajo ya lo lleva
 * —«tres platos»—, así que decirlo arriba era decirlo dos veces en la misma
 * fila. Sin esto, las dos pantallas hermanas contestarían distinto a la misma
 * pregunta, que es justo lo que `titularDeHoy` se puso para evitar.
 */
const LETRAS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez']
export const enLetras = (n) => (n >= 0 && n <= 10 ? LETRAS[n] : String(n))
export function titularDeCena(cena, platos = []) {
  if (!cena) return 'Sin cena montada'
  if (cena.fuera) return titularDeFuera(cena)
  return titularDePlatos(platos) ?? 'Cena sin platos apuntados'
}

/** Sin tildes y en minúscula, la misma vara que `buscarGente` (lib/reparto-gente.js). */
const plano = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Las filas de un elegidor que casan con lo escrito
 * (`docs/diseño/elegidores.html` · L3). Con la caja vacía salen todas: el
 * buscador filtra la lista, no la esconde. Mira también la nota porque en los
 * platos es la categoría — buscar «postre» es tan legítimo como buscar «sandía».
 */
export function filtraOpciones(opciones = [], texto = '') {
  const q = plano(texto).trim()
  if (!q) return opciones
  return opciones.filter((o) => plano(o.etiqueta).includes(q) || plano(o.nota).includes(q))
}

/** «a», «a y b», «a, b y c» — la enumeración de toda la vida. */
const enumerar = (cosas = []) => (
  cosas.length <= 1 ? (cosas[0] ?? '')
    : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`
)

/**
 * Los `cuantos` primeros por su nombre y el resto contado.
 *
 * La coma no es cosmética: con resto, la «y» ya la gasta el recuento, y
 * enumerar de la forma normal daba **«Jamón y Tortilla y 1 más»**, con dos «y»
 * seguidas que se leen como si el tercero se llamara «1 más». Sin resto se
 * enumera como toda la vida.
 */
function juntarYContar(nombres, cuantos) {
  const resto = nombres.length - cuantos
  if (resto <= 0) return enumerar(nombres)
  return `${nombres.slice(0, cuantos).join(', ')} y ${resto} más`
}

/**
 * Cuántas letras entran en el renglón de debajo del titular.
 *
 * Mide los mismos **289 pt** pero con letra más pequeña (`--t-sub`), así que
 * entra más: «Bici eléctrica · Kayak por la cala» son 34 letras y 250 pt, y
 * «Bici eléctrica a Cadaqués · Kayak por la cala» son 44 y 347,4. El tope va en
 * **36**, la última medida que cabe.
 *
 * Y aquí el tope importa **más** que en el titular, aunque este renglón sí parta
 * línea: partirla cuesta **+22,8 pt**, y la tarjeta de ocho días mide 590,8 en
 * un hueco de 594. Sobran 3,2 — o sea que un solo día que crezca hace rodar la
 * lista entera.
 */
export const LETRAS_DEL_RENGLON = 36

/**
 * Enumera lo que quepa y cuenta el resto: «Kayak por la cala y 2 más».
 *
 * Va probando con uno menos hasta que entra, en vez de cortar por el número de
 * elementos: dos planes de nombre corto caben y uno solo de nombre largo no, así
 * que el tope tiene que ser el ancho y no la cuenta. Con uno solo se rinde y lo
 * devuelve aunque se pase — algo hay que decir, y recortar es cosa del CSS.
 */
export function enumerarConTope(nombres = [], letras = LETRAS_DEL_RENGLON) {
  const limpios = nombres.filter(Boolean)
  if (limpios.length === 0) return ''
  for (let n = limpios.length; n >= 1; n -= 1) {
    const texto = juntarYContar(limpios, n)
    if (texto.length <= letras || n === 1) return texto
  }
  return ''
}

/**
 * La cena de esta noche **redactada** (`docs/diseño/hoy-el-dia.html` · T1).
 *
 * Devuelve **trozos** y no una cadena porque hay que poner en negrita lo que se
 * busca —el plato que manda y los dos bungas— y componer eso en la pantalla
 * sería volver a partir la frase allí. `fuerte` es la negrita.
 *
 * Los nombres de los platos van **tal como están escritos**, también en medio de
 * la frase: bajarles la primera letra convertiría «BBQ de pescado» en «bBQ de
 * pescado», y un plato es un nombre propio.
 */
export function fraseDeLaNoche({ cena, platos = [], bungaMayores, bungaNinos, esHoy = true } = {}) {
  const trozos = []
  // Se cena fuera: ni platos ni bungas, que esta noche no acoge nadie.
  if (cena?.fuera) {
    const donde = (cena.donde ?? '').trim()
    trozos.push({ t: esHoy ? 'Esta noche se cena fuera' : 'Se cena fuera' })
    if (donde) trozos.push({ t: ', en ' }, { t: donde, fuerte: true })
    trozos.push({ t: donde ? '.' : ', y todavía no se sabe dónde.' })
    return trozos
  }
  const manda = platoQueManda(platos)
  // En el orden en que se comen y no en el que se marcaron: «con patatas
  // chafadas y helado» y no «con helado y patatas chafadas».
  const resto = porOrdenDeCarta(platos.filter((p) => p !== manda)).map((p) => p.name)

  if (!manda) {
    trozos.push({ t: esHoy ? 'Esta noche hay cena, todavía sin platos apuntados.' : 'Hay cena, todavía sin platos apuntados.' })
  } else {
    trozos.push({ t: esHoy ? 'Esta noche ' : 'Se cena ' })
    trozos.push({ t: manda.name, fuerte: true })
    trozos.push({ t: resto.length ? `, con ${enumerar(resto)}.` : '.' })
  }

  if (bungaMayores && bungaNinos) {
    trozos.push({ t: ' Los mayores cenan en ' }, { t: bungaMayores, fuerte: true })
    trozos.push({ t: ' y los niños en ' }, { t: bungaNinos, fuerte: true }, { t: '.' })
  } else if (bungaMayores) {
    trozos.push({ t: ' Se cena en ' }, { t: bungaMayores, fuerte: true }, { t: '.' })
  } else if (bungaNinos) {
    trozos.push({ t: ' Los niños cenan en ' }, { t: bungaNinos, fuerte: true }, { t: '.' })
  } else {
    trozos.push({ t: ' Sin bungas repartidos todavía.' })
  }
  return trozos
}

/**
 * El titular grande de «Hoy» titula **lo que hay**, no siempre la cena
 * (`docs/diseño/dia-abierto.html` · P2): la cena con platos manda; sin ella,
 * manda el plan del día; sin nada, «Día libre». Antes el lunes de la playa
 * confirmada abría la app diciendo «Sin cena montada» —lo que **no** hay— con
 * el día de verdad 127 pt más abajo, en letra de fila. Es la regla que la fila
 * de Días ya usaba (`resumenDeDia`): dos pantallas hermanas no contestan
 * distinto a la misma pregunta. Lo que no manda baja al renglón pequeño.
 *
 * Una cena vacía pero montada (con bungas y sin platos) solo manda si tampoco
 * hay plan: es un hueco reservado, no lo que se hace ese día.
 */
export function titularDeHoy({ cena, platos = [], planes = [], bungaMayores, bungaNinos, esHoy = true } = {}) {
  // Una cena fuera **manda siempre**, aunque haya plan: es lo que se hace esa
  // noche, y decidida está — no es el hueco reservado de una cena sin platos.
  if (cena?.fuera) {
    return {
      grande: titularDeFuera(cena),
      pequeno: planes.length ? planes[0].titulo : 'Esta noche no cocina nadie',
      frase: fraseDeLaNoche({ cena, platos, esHoy }),
    }
  }
  const conPlatos = (cena?.platoIds?.length ?? 0) > 0
  if (conPlatos || (cena && planes.length === 0)) {
    const bungas = [bungaMayores && `Mayores en ${bungaMayores}`, bungaNinos && `niños en ${bungaNinos}`]
      .filter(Boolean).join(' · ')
    return {
      grande: titularDeCena(cena, platos),
      pequeno: bungas || 'Sin bungas repartidos todavía',
      frase: fraseDeLaNoche({ cena, platos, bungaMayores, bungaNinos, esHoy }),
    }
  }
  const deCena = cena ? 'cena sin platos apuntados' : 'sin cena montada todavía'
  if (planes.length > 0) {
    const plan = planes[0]
    const estado = plan.estado === 'confirmado' ? 'Confirmado' : 'A votación'
    const donde = plan.ubicacion ? `, en ${plan.ubicacion}` : ''
    return { grande: plan.titulo, pequeno: `${estado}${donde} · ${deCena}` }
  }
  return { grande: 'Día libre', pequeno: 'Sin cena montada y sin planes — también hace falta' }
}
