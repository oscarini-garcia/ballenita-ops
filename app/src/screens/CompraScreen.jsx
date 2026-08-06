// La lista de la compra: lo que sale de las recetas y lo que se apunta a mano.
//
// Lo que calculan las cenas se rehace solo al cambiarlas y **lo dice**, pero no
// toca nunca ni lo escrito a mano ni lo ya comprado (SPECS §14.20).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  shopItemsOf, addShopItem, removeShopItem, markBought, unmarkBought,
  clearBoughtShopItems, SHOP_CATEGORIES, personsOf, dinnersOf, bungasOf, listDishes,
  sincronizarCompraDesdeCenas,
} from '../db.js'
import { tap } from '../lib/native.js'
import { useIdentidad } from '../lib/identidad.js'
import { comoSeReparte } from '../lib/compra.js'
import { cifra } from '../lib/receta.js'
import Recado from '../components/Recado.jsx'

const catOf = (id) => SHOP_CATEGORIES.find((c) => c.id === id) ?? SHOP_CATEGORIES.at(-1)

/** Lo que se lee a la derecha de la línea. Lo apuntado a mano no lleva cifra. */
function cantidadDe(it) {
  if (it.origen !== 'cena') return ''
  if (it.cantidad === null || it.cantidad === undefined) return 'sin cantidad'
  // Lo redondeado al envase, que es lo que hay que coger. La cifra exacta se ve
  // al abrir la línea: sirve para decidir en el pasillo si se coge de menos.
  return it.compra || `${cifra(it.cantidad)}${it.unidad ? ` ${it.unidad}` : ''}`
}

/** Una firma barata de una tabla, para no rehacer la compra en cada pintado. */
const firma = (filas) => (filas ?? []).map((f) => `${f.id}:${f.updatedAt}`).join('|')

// "hoy 18:30", "ayer 9:05" o "5 ago 18:30" — corto para la fila.
function fmtWhen(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dia = new Date(d); dia.setHours(0, 0, 0, 0)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const difDias = Math.round((hoy - dia) / 86400000)
  if (difDias === 0) return `hoy ${hora}`
  if (difDias === 1) return `ayer ${hora}`
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${hora}`
}

export default function CompraScreen({ eventId, event }) {
  const items = useLiveQuery(() => shopItemsOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  // Qué línea está abierta: el desglose entre las dos mesas se mira al tocarla
  // (C1). La lista es lo que hay que meter en el carro y nada más; el reparto
  // sirve en la cocina, no en el pasillo del súper.
  const [abierta, setAbierta] = useState(null)

  /**
   * Las líneas que vienen de las cenas se rehacen solas (§14.20 · E2).
   *
   * Al abrir la pantalla y cada vez que cambia una cena, un plato o la gente:
   * son las tres cosas de las que sale la cuenta. Lo escrito a mano y lo ya
   * comprado no se tocan — eso lo decide `sincronizarCompraDesdeCenas`.
   */
  useEffect(() => {
    if (!eventId || !cenas || !platos || !persons) return
    sincronizarCompraDesdeCenas(eventId, { cenas, platos, personas: persons })
  }, [eventId, firma(cenas), firma(platos), firma(persons)])
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('otros')

  // Quién eres, para firmar quién marcó la compra. Sale de `lib/identidad.js`,
  // igual que en la cabecera y en Ajustes: esta pantalla leía la llave vieja
  // (`ballena.person.<evento>`), que ya no escribe nadie, así que firmaba en
  // blanco todas las compras.
  const { meId: me } = useIdentidad(eventId, persons)
  const nameOf = (id) => persons.find((p) => p.id === id)?.name ?? 'alguien'
  const bungaDe = (id) => bungas.find((b) => b.id === id)
  // Los nombres de las dos mesas, para que el reparto diga **dónde llevarlo** y
  // no solo a quién. Se cogen de la primera cena que los tenga puestos.
  const conMesas = cenas.find((c) => c.bungaMayoresId || c.bungaNinosId)
  const mesas = {
    mayores: bungaDe(conMesas?.bungaMayoresId)?.alias || bungaDe(conMesas?.bungaMayoresId)?.name || 'Mayores',
    ninos: bungaDe(conMesas?.bungaNinosId)?.alias || bungaDe(conMesas?.bungaNinosId)?.name || 'Niños',
  }

  async function add() {
    const t = texto.trim()
    if (!t) return
    tap()
    await addShopItem(eventId, { texto: t, categoria })
    setTexto('')
  }
  function toggle(it) {
    tap()
    if (it.comprado) unmarkBought(it.id)
    else markBought(it.id, me || null)
  }

  const pendientes = items.filter((x) => !x.comprado)
  const comprados = items
    .filter((x) => x.comprado)
    .sort((a, b) => (b.compradoEn || '').localeCompare(a.compradoEn || ''))

  // Pendientes agrupados por categoría (en el orden de SHOP_CATEGORIES).
  const grupos = SHOP_CATEGORIES
    .map((c) => ({ cat: c, list: pendientes.filter((x) => x.categoria === c.id) }))
    .filter((g) => g.list.length > 0)

  return (
    <div className="body">
      <div className="card tight">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder="Apunta algo: hielos, vino, fruta…"
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={add} disabled={!texto.trim()}>Añadir</button>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {SHOP_CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`chip${categoria === c.id ? ' on' : ''}`}
              onClick={() => { tap(); setCategoria(c.id) }}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && (
        <div className="empty">
          <span className="e">🛒</span>La lista está vacía.<br />
          Apunta lo que haga falta comprar arriba.<br />
          El hielo se acaba solo, pero no se apunta solo.
        </div>
      )}

      {grupos.map(({ cat, list }) => (
        <div key={cat.id}>
          <div className="sec-h">{cat.icon} {cat.label}</div>
          <div className="card tight">
            {list.map((it, i) => (
              <button
                key={it.id}
                className="row"
                onClick={() => toggle(it)}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}
              >
                <div className="av" style={{ background: 'var(--foam-2)', border: '2px solid var(--line)', color: 'transparent' }} aria-hidden>✓</div>
                <div className="main">
                  <div className="n">{it.texto}</div>
                  {/* Lo que ha cambiado se dice en la línea (E2): un número que
                      cambia sin decir por qué no se lee como «bien calculado»,
                      se lee como «esto se mueve solo». */}
                  {it.cambio && (
                    <div className="compra-sub">
                      <span className="cambio">
                        eran {it.cambio.antes === null ? 'sin cantidad' : `${cifra(it.cambio.antes)}${it.cambio.unidad ? ` ${it.cambio.unidad}` : ''}`}
                      </span>
                      {' · cambió una cena'}
                    </div>
                  )}
                  {abierta === it.id && (
                    <div className="compra-sub">
                      {[
                        it.envase,
                        it.exacto ? `hacen falta ${it.exacto}` : null,
                        it.desglose ? comoSeReparte(it.desglose, { ...mesas, unidad: it.unidad }) : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <span className={`compra-cant${it.origen === 'cena' && it.cantidad === null ? ' falta' : ''}`}>
                  {cantidadDe(it)}
                </span>
                <span
                  className="btn sm ghost"
                  role="button"
                  aria-label={it.origen === 'cena' ? `Ver el reparto de ${it.texto}` : 'Borrar'}
                  onClick={(e) => {
                    e.stopPropagation(); tap()
                    if (it.origen === 'cena') setAbierta(abierta === it.id ? null : it.id)
                    else removeShopItem(it.id)
                  }}
                >{it.origen === 'cena' ? (abierta === it.id ? '▴' : '▾') : '×'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {comprados.length > 0 && (
        <>
          <div className="sec-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ya en el carro · {comprados.length}</span>
            <button className="btn sm ghost" onClick={() => { tap(); clearBoughtShopItems(eventId) }}>limpiar comprados</button>
          </div>
          <div className="card tight">
            {comprados.map((it, i) => (
              <button
                key={it.id}
                className="row"
                onClick={() => toggle(it)}
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', opacity: .6, borderTop: i ? '1px solid var(--line-soft)' : 'none' }}
              >
                <div className="av hecho">✓</div>
                <div className="main">
                  <div className="n" style={{ textDecoration: 'line-through' }}>{it.texto}</div>
                  <div className="sub">
                    {catOf(it.categoria).label}
                    {it.compradoPor ? ` · ${nameOf(it.compradoPor)}` : ''}
                    {it.compradoEn ? ` · ${fmtWhen(it.compradoEn)}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* El recado del viaje, al final de la lista (SPECS §14.25). */}
      <Recado evento={event} />
    </div>
  )
}
