// La lista de la compra: lo que sale de las recetas y lo que se apunta a mano.
//
// Lo que calculan las cenas se rehace solo al cambiarlas y **lo dice**, pero no
// toca nunca ni lo escrito a mano ni lo ya comprado (SPECS §14.20).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  shopItemsOf, addShopItem, removeShopItem, markBought, unmarkBought,
  clearBoughtShopItems, SHOP_CATEGORIES, personsOf, dinnersOf, bungasOf, listDishes,
  sincronizarCompraDesdeCenas, familiesOf,
} from '../db.js'
import { tap } from '../lib/native.js'
import { useIdentidad } from '../lib/identidad.js'
import { comoSeReparte } from '../lib/compra.js'
import { cifra } from '../lib/receta.js'
import Recado from '../components/Recado.jsx'
import Icono from '../components/Icono.jsx'
import Alias from '../components/Alias.jsx'
import { dondeSeApunta, gruposDeCompra } from '../lib/compra-familias.js'

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
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  // Qué línea está abierta: el desglose entre las dos mesas se mira al tocarla
  // (C1). La lista es lo que hay que meter en el carro y nada más; el reparto
  // sirve en la cocina, no en el pasillo del súper.
  const [abierta, setAbierta] = useState(null)
  // La línea escrita a mano que espera su segunda pulsación para irse. Una sola
  // a la vez: preguntar por dos cosas en dos sitios se contesta mal.
  const [quitando, setQuitando] = useState(null)

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
  // **De quién es lo que se apunta** (§14.54): nulo = de todos. Arranca en la
  // tuya si la app sabe quién eres, porque la mitad de lo que se apunta a mano
  // —la leche sin lactosa, el pan sin gluten— es de una casa y no del grupo. Lo
  // común sigue a un toque, y el renglón dice siempre en cuál de las dos estás.
  const [destino, setDestino] = useState(undefined)

  // Quién eres, para firmar quién marcó la compra. Sale de `lib/identidad.js`,
  // igual que en la cabecera y en Ajustes: esta pantalla leía la llave vieja
  // (`ballena.person.<evento>`), que ya no escribe nadie, así que firmaba en
  // blanco todas las compras.
  const { meId: me } = useIdentidad(eventId, persons)
  // La familia de quien tiene el móvil, para arrancar el destino en la suya.
  const miFamilia = persons.find((p) => p.id === me)?.familyId ?? null
  useEffect(() => {
    if (destino === undefined && persons.length) setDestino(miFamilia)
  }, [destino, miFamilia, persons.length])
  const famDestino = families.find((f) => f.id === destino) ?? null
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
    await addShopItem(eventId, { texto: t, categoria, familyId: destino ?? null })
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

  // **Pendientes agrupados por de quién son, y dentro por categoría** (§14.54 ·
  // C1+C2). Antes eran solo categorías; ahora el primer corte es el dueño,
  // porque en el súper lo que se pregunta es «¿qué me llevo yo?» y no «¿qué hay
  // de bebida?». Todo se ve —en esta app no hay nada privado— y eso es lo que
  // hace que quien sale hacia el súper pregunte una vez en vez de nueve.
  const grupos = gruposDeCompra(pendientes, families, SHOP_CATEGORIES)

  return (
    <div className="body">
      {/* El recado, **bajo el selector** y no al final del scroll
          (SPECS §14.44): al final no lo lee nadie — en una lista larga
          hay que llegar hasta abajo, y en Gastos eso es todo el viaje. */}
      <Recado evento={event} />

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
        {/* **Para quién** (§14.54 · C1). Se dice siempre, también cuando es
            «todos»: un renglón que solo habla cuando has elegido familia deja el
            caso normal sin decir dónde va lo que escribes, y esa es justo la vez
            que hay que acertar. Solo sale con familias en el evento. */}
        {families.length > 0 && (
          /* Segmentado pequeño y no otra tira de chips: con cinco categorías
             arriba, cuatro chips más envolvían en dos líneas y la tarjeta de
             apuntar pasaba de 200 a 350 pt — la mitad de la pantalla para
             escribir «hielo». `.seg.mini` cabe en un renglón y rueda de lado
             cuando hay más familias de las que caben. */
          <div className="seg mini destino-compra" role="group" aria-label="Para quién se apunta">
            <button
              type="button"
              aria-pressed={!destino}
              onClick={() => { tap(); setDestino(null) }}
            >
              Todos
            </button>
            {[...families]
              .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={destino === f.id}
                  onClick={() => { tap(); setDestino(f.id) }}
                >
                  {f.name}
                </button>
              ))}
          </div>
        )}
        <div className="pista" style={{ marginTop: 6 }}>{dondeSeApunta(famDestino)}</div>
      </div>

      {items.length === 0 && (
        <div className="empty">
          <span className="e">🛒</span>La lista está vacía.<br />
          Apunta lo que haga falta comprar arriba.<br />
          El hielo se acaba solo, pero no se apunta solo.
        </div>
      )}

      {grupos.map(({ clave, titulo, familia, cat, list }) => (
        <div key={clave}>
          <div className="sec-h">
            <span>
              {familia
                ? <>{titulo}<Alias familia={familia} /></>
                : <>{cat ? `${cat.icon} ` : ''}{titulo}</>}
            </span>
            {familia && <span>{list.length}</span>}
          </div>
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
                {/* Dos controles distintos y no uno con dos caras. Antes eran el
                    mismo `btn sm ghost` en la misma columna: en una línea de cena
                    **desplegaba** el reparto y en una escrita a mano **borraba**,
                    y para saber cuál te tocaba había que mirar de dónde venía la
                    fila. Ahora el que destruye lleva su color y **pregunta con una
                    segunda pulsación** (borrar-confirmaciones.html · defecto uno · A1):
                    aquí no hay cascada que contar —una línea no arrastra nada—, solo
                    hay que evitar el toque de más, y eso cuesta 0 pt de alto. */}
                {it.origen === 'cena' ? (
                  <span
                    className="btn sm ghost"
                    role="button"
                    aria-label={`Ver el reparto de ${it.texto}`}
                    onClick={(e) => { e.stopPropagation(); tap(); setAbierta(abierta === it.id ? null : it.id) }}
                  >{abierta === it.id ? '▴' : '▾'}</span>
                ) : (
                  <span
                    className={`btn sm ghost quitar${quitando === it.id ? ' seguro' : ''}`}
                    role="button"
                    aria-label={quitando === it.id ? `Confirmar que se borra ${it.texto}` : `Borrar ${it.texto}`}
                    onClick={(e) => {
                      e.stopPropagation(); tap()
                      if (quitando === it.id) { removeShopItem(it.id); setQuitando(null) }
                      else setQuitando(it.id)
                    }}
                  >{quitando === it.id ? '¿Seguro?' : <Icono nombre="papelera" className="g" />}</span>
                )}
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

    </div>
  )
}
