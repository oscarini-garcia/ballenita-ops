import { useRef } from 'react'
import { tap } from '../lib/native.js'
import { normalizarIngredientes, sinCantidad, cifra, partirCantidad, juntarCantidad, partirPegado } from '../lib/receta.js'

/**
 * Los ingredientes de una receta: **dos campos por línea** y todo inline.
 *
 * Decidido en [`docs/diseño/receta-ingredientes.html`](../../../docs/diseño/receta-ingredientes.html)
 * · **U1 · B3 · L2 + L4**.
 *
 * - **La unidad vive dentro del campo de la cantidad** (U1). Se escribe «1,2 kg»
 *   de un tirón, que es como se dice en voz alta, y la app lo parte al guardar.
 *   La compra necesita el número y la unidad por separado —sin eso no puede
 *   sumar dos recetas ni redondear al envase—, pero eso es cosa suya, no de
 *   quien escribe. Se puede rellenar **solo el nombre**: «tres pinchos de
 *   wagyu» es una línea válida hasta que alguien pulse «Arreglar».
 * - **Un aspa pequeña y sin caja** (B3), de 26 pt. Deslizar no se veía, y borrar
 *   es la mitad de lo que se hace escribiendo una receta. Cuesta 34 pt de ancho
 *   al nombre, que es lo más barato de las cuatro formas medidas.
 * - **Siempre hay una fila vacía al final** (L2): escribir un ingrediente no
 *   cuesta ningún toque de más. La fila fantasma no se guarda.
 * - **Pegar varias líneas las reparte** (L4): una receta de internet entra
 *   entera y se ordena después con el botón.
 */
export default function Ingredientes({ valor = [], raciones, onCambiar, autoFocus = false }) {
  // Sin recortar: se está escribiendo, y el espacio que acabas de teclear no
  // puede desaparecer antes de la letra siguiente. El recorte es al guardar.
  const lineas = normalizarIngredientes(valor, { recortar: false })
  const primera = useRef(null)

  const cambiar = (i, campos) => onCambiar(lineas.map((x, j) => (j === i ? { ...x, ...campos } : x)))

  /** Escribir en la fila fantasma la convierte en una línea de verdad. */
  function escribirEn(i, campos) {
    if (i < lineas.length) return cambiar(i, campos)
    onCambiar([...lineas, { nombre: '', cantidad: null, unidad: '', ...campos }])
  }

  function quitar(i) {
    tap()
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

  return (
    <div className="card tight lista-ing">
      {filas.map((ing, i) => {
        const fantasma = ing === null
        const linea = ing ?? { nombre: '', cantidad: null, unidad: '' }
        const rotulo = linea.nombre || `${i + 1}`
        return (
          <div className="fila-ing" key={`ing-${i}`}>
            <input
              type="text"
              className="ing-cant tnum"
              aria-label={`Cantidad de ${rotulo}`}
              value={juntarCantidad(linea)}
              placeholder="—"
              onChange={(e) => {
                const { cantidad, unidad } = partirCantidad(e.target.value)
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
                onChange={(e) => escribirEn(i, { nombre: e.target.value })}
                onPaste={(e) => alPegar(e, i)}
              />
              <div className="ing-detalle">{fantasma ? '' : detalleDe(linea, raciones)}</div>
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
  )
}

/**
 * Lo que hay que decir de esa línea, y solo cuando hay algo que decir.
 *
 * Por ración, porque es lo que deja juzgar si la cifra tiene sentido —«100 g de
 * arroz por persona» se reconoce, «1,2 kg» no—; en qué se compra, porque es lo
 * que permite redondear; y de quién es el número, que es lo que hace falta saber
 * cuando algo sale corto.
 */
export function detalleDe(ing, raciones) {
  const partes = []
  if (!sinCantidad(ing) && raciones > 0) {
    partes.push(`${cifra(ing.cantidad / raciones)}${ing.unidad ? ` ${ing.unidad}` : ''}/ración`)
  }
  if (ing.lote?.tamano) {
    partes.push(`${ing.lote.nombre || 'envase'} de ${cifra(ing.lote.tamano)}${ing.lote.unidad ? ` ${ing.lote.unidad}` : ''}`)
  }
  if (ing.deIA) partes.push('lo puso la IA')
  return partes.join(' · ')
}
