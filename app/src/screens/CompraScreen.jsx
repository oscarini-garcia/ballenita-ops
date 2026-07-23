import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  shopItemsOf, addShopItem, updateShopItem, removeShopItem,
  clearBoughtShopItems, SHOP_CATEGORIES,
} from '../db.js'
import { tap } from '../lib/native.js'

const catOf = (id) => SHOP_CATEGORIES.find((c) => c.id === id) ?? SHOP_CATEGORIES.at(-1)

export default function CompraScreen({ eventId }) {
  const items = useLiveQuery(() => shopItemsOf(eventId), [eventId], [])
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('otros')

  async function add() {
    const t = texto.trim()
    if (!t) return
    tap()
    await addShopItem(eventId, { texto: t, categoria })
    setTexto('')
  }
  function toggle(it) { tap(); updateShopItem(it.id, { comprado: !it.comprado }) }

  const pendientes = items.filter((x) => !x.comprado)
  const comprados = items.filter((x) => x.comprado)

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
        <div className="empty"><span className="e">🛒</span>La lista está vacía.<br />Apunta lo que haga falta comprar arriba.</div>
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
                <div className="main"><div className="n">{it.texto}</div></div>
                <span
                  className="btn sm ghost"
                  role="button"
                  aria-label="Borrar"
                  onClick={(e) => { e.stopPropagation(); tap(); removeShopItem(it.id) }}
                >×</span>
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
                style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', opacity: .55, borderTop: i ? '1px solid var(--line-soft)' : 'none' }}
              >
                <div className="av" style={{ background: 'var(--spout)', color: '#fff' }}>✓</div>
                <div className="main"><div className="n" style={{ textDecoration: 'line-through' }}>{it.texto}</div><div className="sub">{catOf(it.categoria).label}</div></div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
