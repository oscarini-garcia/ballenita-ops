/**
 * Qué se lleva por delante un borrado, dicho en una frase.
 *
 * Los cuatro borrados de **Grupo** llevaban esto desde §14.14 y son la razón de
 * que se pueda contestar a su pregunta: «se borran los Pérez, su gente se queda
 * sin familia» dice lo que va a pasar, no lo que se está tocando. Los tres que
 * no preguntaban nada —un gasto, una cena y una línea de la compra— no son los
 * tres borrados más pequeños: son los tres que mueven cosas que quien borra
 * **no tiene delante** (`docs/diseño/borrar-confirmaciones.html` · A2·B2·B3).
 *
 * Aquí solo se compone el texto. Es puro —recibe las listas y devuelve una
 * cadena— porque una frase que cuenta cosas se prueba contando, y porque el
 * número es la mitad del mensaje: «6 líneas» y «ninguna» son dos decisiones
 * distintas, y por eso **el cero no se dice** (B3): cuando no arrastra nada, la
 * frase se queda corta en vez de escribir «se van 0 líneas», que es algo que
 * nadie diría en voz alta.
 */
import { loQueHayQueComprar } from './compra.js'

const cuenta = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`

/**
 * Las familias a las que un gasto les mueve el saldo: las que pagaron y las que
 * entran en el reparto.
 *
 * Sin `participantIds` el gasto es de todos, que es como nace un gasto rápido
 * (§14.26): entonces cuentan todas las familias que tienen a alguien dentro.
 */
export function familiasQueTocaUnGasto(gasto, { familias = [], personas = [] } = {}) {
  const dentro = gasto?.participantIds?.length
    ? personas.filter((p) => gasto.participantIds.includes(p.id))
    : personas
  const ids = new Set()
  for (const p of dentro) if (p.familyId) ids.add(p.familyId)
  for (const pagador of gasto?.payers ?? []) if (pagador?.familyId) ids.add(pagador.familyId)
  // Solo las que existen: una familia borrada deja `familyId` apuntando a nada,
  // y contarla sería prometer un efecto sobre alguien que ya no está.
  return [...ids].filter((id) => familias.some((f) => f.id === id))
}

/**
 * La frase de un gasto.
 *
 * El importe y quién pagó van dentro porque la fila deslizada **tapa media
 * fila**: al preguntar hay que devolver lo que el propio gesto ha escondido.
 */
export function queSeLlevaUnGasto(gasto, { familias = [], personas = [], importe = '' } = {}) {
  const nombre = gasto?.description?.trim()
  const quien = (gasto?.payers ?? [])
    .map((p) => familias.find((f) => f.id === p.familyId)?.name)
    .filter(Boolean)
  const cuantas = familiasQueTocaUnGasto(gasto, { familias, personas }).length

  const primera = [
    `Se borra ${nombre ? `«${nombre}»` : 'este gasto'}`,
    importe ? `, ${importe}` : '',
    quien.length ? `, que ${quien.length === 1 ? 'pagó' : 'pagaron'} ${quien.join(', ')}` : '',
    '.',
  ].join('')

  // B3: el saldo solo se nombra cuando hay más de una familia en juego. Con una
  // sola no hay reparto que rehacer, y decirlo sería inflar la advertencia.
  if (cuantas < 2) return primera
  return `${primera} Cambia el saldo de ${cuenta(cuantas, 'familia', 'familias')}.`
}

/**
 * Qué líneas de la compra se caen al borrar una cena.
 *
 * No se puede leer de la fila: una línea de la compra no apunta a su cena, sino
 * que sale de **sumar todas** (`origen: 'cena'`, §14.20). Así que se calcula lo
 * mismo dos veces —con esta cena y sin ella— y se mira qué claves desaparecen.
 * Es exactamente lo que hará el recálculo después, y por eso la frase no puede
 * mentir.
 *
 * Lo comprado se cuenta aparte porque **no se va**: ya está en el carro, y
 * quitarlo de la lista no lo saca de ahí.
 */
export function loQueSeCaeDeLaCompra(cena, { cenas = [], platos = [], personas = [], lineas = [] } = {}) {
  const quedan = cenas.filter((c) => c.id !== cena?.id)
  const antes = new Set(loQueHayQueComprar({ cenas, platos, personas }).map((l) => l.clave))
  const despues = new Set(loQueHayQueComprar({ cenas: quedan, platos, personas }).map((l) => l.clave))
  const huerfanas = [...antes].filter((clave) => !despues.has(clave))

  const deLaCena = lineas.filter((l) => l.origen === 'cena' && huerfanas.includes(l.clave))
  return {
    seVan: deLaCena.filter((l) => !l.comprado).length,
    comprado: deLaCena.filter((l) => l.comprado).length,
  }
}

/** La frase de una cena, con los platos que se pierden y lo que arrastra. */
export function queSeLlevaUnaCena(cena, { dia = '', platos = [], cenas = [], personas = [], lineas = [] } = {}) {
  const nombres = [...new Set([...(cena?.platoIds ?? []), ...(cena?.platoIdsNinos ?? [])])]
    .map((id) => platos.find((p) => p.id === id)?.name)
    .filter(Boolean)
  const primera = `Se borra la cena${dia ? ` del ${dia}` : ''}${nombres.length ? ` (${nombres.join(', ')})` : ''}.`

  const { seVan, comprado } = loQueSeCaeDeLaCompra(cena, { cenas, platos, personas, lineas })
  // B3 otra vez: sin líneas que se caigan, la frase se acaba aquí.
  if (!seVan && !comprado) return primera

  const trozos = []
  if (seVan) {
    trozos.push(`Se ${seVan === 1 ? 'va' : 'van'} ${cuenta(seVan, 'línea de la compra', 'líneas de la compra')} que ${seVan === 1 ? 'salía' : 'salían'} de ella`)
  }
  if (comprado) {
    trozos.push(seVan
      ? `${comprado === 1 ? 'la que ya está comprada se queda' : `las ${comprado} que ya están compradas se quedan`}`
      : `${cuenta(comprado, 'línea de la compra ya comprada se queda', 'líneas de la compra ya compradas se quedan')}`)
  }
  return `${primera} ${trozos.join('; ')}.`
}
