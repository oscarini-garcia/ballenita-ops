import { useRef, useState } from 'react'
import { tap } from '../lib/native.js'
import { normalizarIngredientes, sinCantidad, cifra, partirCantidad, juntarCantidad, partirPegado } from '../lib/receta.js'

/**
 * Los ingredientes de una receta: **una lista sin cajas y un renglón al pie**.
 *
 * Decidido en [`docs/diseño/receta-ingredientes.html`](../../../docs/diseño/receta-ingredientes.html)
 * · **U1 · B3 · L2 + L4** y en
 * [`docs/diseño/receta-fina.html`](../../../docs/diseño/receta-fina.html)
 * · **F2 + F4 · C3**.
 *
 * - **La unidad vive dentro del campo de la cantidad** (U1). Se escribe «1,2 kg»
 *   de un tirón, que es como se dice en voz alta, y la app lo parte al guardar.
 *   Se puede rellenar **solo el nombre**: «tres pinchos de wagyu» es una línea
 *   válida hasta que alguien pulse «Arreglar».
 * - **Sin cajas** (F2): los bordes se van y se escribe encima del texto. No es
 *   por sitio —quitarlos ahorra 2 pt por fila, porque el alto lo pone el relleno
 *   del campo y no el borde— sino porque una lista de ocho ingredientes se lee
 *   como una lista y no como ocho formularios. Lo que sí hace falta es que se
 *   vea **dónde estás**: el campo enfocado se tiñe, que es lo que sustituye al
 *   borde.
 * - **El detalle, en un solo renglón al pie** (F4). Antes cada línea llevaba
 *   debajo su «0,1 kg/ración · paquete de 1 kg», y eso **casi dobla la fila**:
 *   105,9 pt frente a 60,6, de modo que escribir una cantidad alargaba la lista
 *   45 pt bajo el dedo. Ahora hay un renglón al final que dice el detalle **de
 *   la línea que estás tocando**, y cuando no tocas ninguna, el resumen: para
 *   cuántas es y cuántas van sin cantidad, que es lo que hay que saber para
 *   decidir si pulsar «Arreglar».
 * - **El mando dice qué cantidad se escribe** (C3): «Para 12» o «Por persona».
 *   Lo guardado es **siempre el total de la receta**; el mando solo cambia en
 *   qué unidades se teclea, y el renglón del pie enseña la otra. Sin raciones no
 *   hay «por persona» que valga, y el mando lo dice en vez de mentir.
 * - **Un aspa pequeña y sin caja** (B3), de 26 pt. Deslizar no se veía, y borrar
 *   es la mitad de lo que se hace escribiendo una receta.
 * - **Siempre hay una fila vacía al final** (L2) y **pegar varias líneas las
 *   reparte** (L4).
 */
export default function Ingredientes({ valor = [], raciones, onCambiar, autoFocus = false }) {
  // Sin recortar: se está escribiendo, y el espacio que acabas de teclear no
  // puede desaparecer antes de la letra siguiente. El recorte es al guardar.
  const lineas = normalizarIngredientes(valor, { recortar: false })
  const primera = useRef(null)
  // Qué se teclea (C3). Sin raciones solo cabe una postura, así que la otra ni
  // se puede elegir ni se queda elegida.
  const [porPersona, setPorPersona] = useState(false)
  const conRaciones = raciones > 0
  const repartiendo = porPersona && conRaciones
  // La línea que se está tocando, que es de la que habla el pie.
  const [foco, setFoco] = useState(null)
  // Lo que hay tecleado en la caja de la cantidad **antes de que sea un número**.
  // Sin esto la caja se repinta con lo que el modelo haya entendido, y escribir
  // «1,2» era imposible: en cuanto llevabas «1,» volvía «1» y la coma se perdía.
  // Solo hace falta para una línea, porque solo una puede tener el cursor.
  const [borrador, setBorrador] = useState(null) // { i, texto }

  const cambiar = (i, campos) => onCambiar(lineas.map((x, j) => (j === i ? { ...x, ...campos } : x)))

  /** Escribir en la fila fantasma la convierte en una línea de verdad. */
  function escribirEn(i, campos) {
    if (i < lineas.length) return cambiar(i, campos)
    onCambiar([...lineas, { nombre: '', cantidad: null, unidad: '', ...campos }])
  }

  function quitar(i) {
    tap()
    setBorrador(null)
    onCambiar(lineas.filter((_, j) => j !== i))
  }

  /**
   * Pegar una receta entera (L4).
   *
   * Cada línea se queda **completa en el nombre**: partirla aquí sería adivinar,
   * y para eso está el botón de arreglar, que lo hace mirando el plato entero.
   */
  function alPegar(e, i) {
    const trozos = partirPegado(e.clipboardData?.getData('text') ?? '')
    if (trozos.length < 2) return
    e.preventDefault()
    const nuevas = trozos.map((nombre) => ({ nombre, cantidad: null, unidad: '' }))
    onCambiar([...lineas.slice(0, i), ...nuevas, ...lineas.slice(i + 1)])
  }

  // La fila fantasma del final: siempre hay dónde escribir el siguiente.
  const filas = [...lineas, null]
  const tocada = foco !== null && foco < lineas.length ? lineas[foco] : null
  const alPie = (tocada && detalleDe(tocada, raciones, repartiendo)) || resumenDeLista(lineas, raciones)

  return (
    <>
      {/* El mando **es** el rótulo de la columna: dice qué cantidad se escribe
          y ocupa el renglón que si no llevaría una etiqueta muerta. */}
      <div className="cab-ing">
        <div className="seg mini" role="group" aria-label="Qué cantidad se escribe">
          <button
            type="button"
            aria-pressed={!repartiendo}
            onClick={() => { tap(); setPorPersona(false); setBorrador(null) }}
          >{conRaciones ? `Para ${raciones}` : 'Toda la receta'}</button>
          <button
            type="button"
            aria-pressed={repartiendo}
            disabled={!conRaciones}
            onClick={() => { tap(); setPorPersona(true); setBorrador(null) }}
          >Por persona</button>
        </div>
      </div>

      <div
        className={`card tight lista-ing${repartiendo ? ' repartiendo' : ''}`}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget)) return
          setFoco(null)
          setBorrador(null)
        }}
      >
        {filas.map((ing, i) => {
          const fantasma = ing === null
          const linea = ing ?? { nombre: '', cantidad: null, unidad: '' }
          const rotulo = linea.nombre || `${i + 1}`
          return (
            <div className="fila-ing" key={`ing-${i}`}>
              <input
                type="text"
                className="ing-cant tnum"
                aria-label={`Cantidad de ${rotulo}${repartiendo ? ' por persona' : ''}`}
                value={borrador?.i === i ? borrador.texto : juntarCantidad(linea, repartiendo ? raciones : 1)}
                placeholder="—"
                onFocus={() => { setFoco(i); setBorrador(null) }}
                onChange={(e) => {
                  setBorrador({ i, texto: e.target.value })
                  const { cantidad, unidad } = partirCantidad(e.target.value, repartiendo ? raciones : 1)
                  escribirEn(i, { cantidad, unidad, deIA: false })
                }}
              />
              <div className="ing-nombre">
                <input
                  ref={i === 0 ? primera : null}
                  type="text"
                  autoFocus={autoFocus && i === 0}
                  aria-label={fantasma ? 'Ingrediente nuevo' : `Ingrediente ${i + 1}`}
                  value={linea.nombre}
                  placeholder={fantasma ? 'Otro ingrediente…' : ''}
                  onFocus={() => setFoco(i)}
                  onChange={(e) => escribirEn(i, { nombre: e.target.value })}
                  onPaste={(e) => alPegar(e, i)}
                />
              </div>
              {/* Sin caja y de 26: cuesta 34 pt de nombre y pone a la vista lo
                  que más se hace. La fila fantasma no tiene nada que borrar. */}
              <button
                type="button"
                className={`aspa-ing${fantasma ? ' invisible' : ''}`}
                aria-label={fantasma ? undefined : `Quitar ${linea.nombre || 'el ingrediente'}`}
                aria-hidden={fantasma || undefined}
                tabIndex={fantasma ? -1 : undefined}
                onClick={fantasma ? undefined : () => quitar(i)}
              >×</button>
            </div>
          )
        })}
      </div>

      {/* Un renglón, siempre el mismo sitio y siempre el mismo alto: si apareciera
          y desapareciera, la pantalla saltaría cada vez que tocas una línea. */}
      <div className="pie-ing" role="status">{alPie}</div>
    </>
  )
}

/**
 * Lo que hay que decir de la línea que se está tocando.
 *
 * **La otra cantidad**, que es lo que el mando no enseña: si escribes el total
 * te dice cuánto sale por ración —«100 g de arroz por persona» se reconoce,
 * «1,2 kg» no—, y si escribes por persona te dice el total, que es lo que se
 * compra. Después, en qué envase viene y de quién era el número, que es lo que
 * hace falta saber cuando algo sale corto.
 */
export function detalleDe(ing, raciones, porPersona = false) {
  const partes = []
  if (!sinCantidad(ing) && raciones > 0) {
    const unidad = ing.unidad ? ` ${ing.unidad}` : ''
    partes.push(porPersona
      ? `${cifra(ing.cantidad)}${unidad} para ${raciones}`
      : `${cifra(ing.cantidad / raciones)}${unidad}/ración`)
  }
  if (ing.lote?.tamano) {
    partes.push(`${ing.lote.nombre || 'envase'} de ${cifra(ing.lote.tamano)}${ing.lote.unidad ? ` ${ing.lote.unidad}` : ''}`)
  }
  if (ing.deIA) partes.push('lo puso la IA')
  return partes.join(' · ')
}

/**
 * El resumen de toda la lista, para cuando no se está tocando ninguna línea.
 *
 * Corto a propósito: son 390 pt y tiene que caber en un renglón. Y dice lo
 * único que no se puede contar de un vistazo con ocho ingredientes delante —
 * **cuántas van sin cantidad**—, que es lo que decide si hay que pulsar
 * «Arreglar» o no.
 */
export function resumenDeLista(lineas, raciones) {
  const conNombre = lineas.filter((x) => String(x.nombre ?? '').trim())
  if (!conNombre.length) return 'Un ingrediente por línea. La cantidad puede esperar.'
  const partes = [raciones > 0 ? `Para ${raciones}` : 'Sin raciones']
  const faltan = conNombre.filter(sinCantidad).length
  if (faltan) partes.push(`${faltan} sin cantidad`)
  const deIA = conNombre.filter((x) => x.deIA).length
  if (deIA) partes.push(`${deIA} de la IA`)
  if (!faltan) partes.push(`${conNombre.length} ${conNombre.length === 1 ? 'ingrediente' : 'ingredientes'}`)
  return partes.join(' · ')
}
