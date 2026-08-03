import { useState } from 'react'
import Icono from './Icono.jsx'
import Deslizable from './Deslizable.jsx'
import { tap } from '../lib/native.js'
import { normalizarIngredientes, sinCantidad, cifra } from '../lib/receta.js'

/**
 * Los ingredientes de una receta, uno por línea y con su cantidad.
 *
 * Decidido en [`docs/diseño/cenas-cantidades.html`](../../../docs/diseño/cenas-cantidades.html)
 * · **A1 + A5**, con el detalle de A4.
 *
 * **La cantidad va en columna, a la izquierda**, como en una receta impresa: las
 * cifras alineadas se comparan sin leerlas, que es lo que se hace al repasar una
 * lista para ver si falta alguna. La columna cuesta 92 pt y al nombre le quedan
 * 234, medidos: caben los ingredientes reales —«Lomo de cerdo adobado» son
 * 216,5— y el que no cabe dobla a dos líneas en vez de recortarse.
 *
 * **La línea crece cuando hace falta** (A4): debajo del nombre sale lo que hay
 * que decir de esa línea —cuánto sale por ración, en qué envase se compra, quién
 * puso la cifra— sin robarle sitio a la columna cuando no hay nada que decir.
 *
 * Y **se borra deslizando** (A5), con el gesto que ya existe en Gastos
 * (§14.10-bis): cinco aspas en pantalla son cinco cosas que se pueden tocar sin
 * querer.
 */
export default function Ingredientes({ valor = [], raciones, onCambiar }) {
  const lineas = normalizarIngredientes(valor)
  const [nuevo, setNuevo] = useState('')

  const cambiar = (i, campos) => onCambiar(lineas.map((x, j) => (j === i ? { ...x, ...campos } : x)))

  function anadir() {
    const n = nuevo.trim()
    if (!n) return
    tap()
    onCambiar([...lineas, { nombre: n, cantidad: null, unidad: '' }])
    setNuevo('')
  }

  function quitar(i) {
    tap()
    onCambiar(lineas.filter((_, j) => j !== i))
  }

  return (
    <>
      <div className="card tight lista-ing">
        {lineas.length === 0 && <div className="empty">Todavía no hay ingredientes.</div>}
        {lineas.map((ing, i) => (
          <Deslizable
            key={`ing-${i}`}
            ancho={76}
            verbos={(
              <button className="verbo borrar" onClick={() => quitar(i)}>
                <Icono nombre="papelera" className="g" />Borrar
              </button>
            )}
          >
            <div className="fila-ing">
              {/* La caja de la cantidad y la de la unidad, juntas y del mismo
                  ancho siempre: un objetivo tocable que cambia de tamaño en cada
                  renglón se falla más que uno que no se mueve. */}
              <div className="ing-cifra">
                <input
                  type="text"
                  inputMode="decimal"
                  className="tnum"
                  aria-label={`Cantidad de ${ing.nombre}`}
                  value={ing.cantidad === null ? '' : String(ing.cantidad).replace('.', ',')}
                  placeholder="—"
                  onChange={(e) => {
                    const t = e.target.value.replace(',', '.').trim()
                    const n = Number(t)
                    cambiar(i, { cantidad: t === '' ? null : (Number.isFinite(n) ? n : ing.cantidad), deIA: false })
                  }}
                />
                <input
                  type="text"
                  className="ing-unidad"
                  aria-label={`Unidad de ${ing.nombre}`}
                  value={ing.unidad}
                  placeholder="ud"
                  onChange={(e) => cambiar(i, { unidad: e.target.value.trim() })}
                />
              </div>
              <div className="ing-nombre">
                <input
                  type="text"
                  aria-label={`Nombre del ingrediente ${i + 1}`}
                  value={ing.nombre}
                  onChange={(e) => cambiar(i, { nombre: e.target.value })}
                />
                <div className="ing-detalle">{detalleDe(ing, raciones)}</div>
              </div>
            </div>
          </Deslizable>
        ))}
      </div>

      {/* El renglón de añadir va fijo bajo la lista y no se cierra al guardar,
          como en Ideas (§14.19-ter): una receta se escribe de seguido. */}
      <div className="anadir-ing">
        <input
          type="text"
          value={nuevo}
          aria-label="Ingrediente nuevo"
          placeholder="Otro ingrediente…"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') anadir() }}
        />
        <button className="btn sm" onClick={anadir} disabled={!nuevo.trim()}>Añadir</button>
      </div>
    </>
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
