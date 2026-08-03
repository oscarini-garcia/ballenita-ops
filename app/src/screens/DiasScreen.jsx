import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, updateDinner, removeDinner,
  plansOf, updatePlan, bungasOf, personsOf, listDishes, DISH_CATEGORIES,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import { HojaDeEleccion, HojaDeMarcar } from '../components/Hoja.jsx'
import { dentroDeFechas } from '../lib/evento.js'
import { votosDe, quienFaltaPorVotar } from '../lib/planes.js'
import {
  diasDe, resumenDeDia, numeroYDia, fmtDiaLargo, fmtDiaCorto, hoyISO, titularDeCena,
} from '../lib/dias.js'

/**
 * «Días»: la lista de días del evento, con un resumen de cada uno.
 *
 * Opción **G1** de `docs/diseño/navegacion.html`: una fila por día, con el
 * número a la izquierda y el resumen en la línea de abajo. Es la misma `.row`
 * que ya usan Gastos y la Compra, y mide 70,7 pt: los ocho días de un viaje
 * entran de una vez en la pantalla y se ve de un vistazo cuál está libre. Una
 * tarjeta por día (G2) no cabía ni con los ocho vacíos.
 *
 * **La fila abre y no lo anuncia** (`docs/diseño/agenda-dia.html · A1`). Llevaba
 * un lápiz de 44 × 44 a la derecha —la opción H1— y se ha ido por dos razones: un
 * día **no se edita** —no es una fila de la base, existe porque el evento tiene
 * esas fechas—, así que el lápiz prometía algo que no pasa; y sus 52 pt (44 del
 * botón y 8 de margen) eran justo los que le faltaban al titular, que pasa de
 * 237 a 289 y deja de recortar «Cine de verano en la plaza». En Planes las filas
 * también son botones enteros sin galón y nadie se pierde.
 */
export default function DiasScreen({ eventId, event }) {
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const planes = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
  const personas = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const platos = useLiveQuery(() => listDishes(event), [event?.id, event?.esDemo], [])
  const [abierto, setAbierto] = useState(null)

  const dias = diasDe(event, [...cenas.map((c) => c.dia), ...planes.map((p) => p.dia)])
  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const nombreBunga = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : null }
  const hoy = hoyISO()

  if (dias.length === 0) {
    return (
      <div className="body">
        <div className="empty">
          <span className="e">🗓️</span>
          Este evento todavía no tiene fechas.<br />
          Ponlas en Ajustes → Evento y aquí saldrá un día por cada uno.
        </div>
      </div>
    )
  }

  return (
    <div className="body">
      <div className="card tight">
        {dias.map((dia, i) => {
          const cena = cenas.find((c) => c.dia === dia)
          const susPlanes = planes.filter((p) => p.dia === dia)
          const { titulo, detalle } = resumenDeDia({
            cena,
            planes: susPlanes,
            platos: (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean),
            bungaMayores: nombreBunga(cena?.bungaMayoresId),
            esPrimero: i === 0,
            esUltimo: i === dias.length - 1,
          })
          const { numero, semana } = numeroYDia(dia)
          const esHoy = dia === hoy
          return (
            <div className={`row fila-dia${esHoy ? ' es-hoy' : ''}`} key={dia}>
              {/* En pantalla el día es un número y tres letras; a quien no ve se
                  le dice la fecha entera, y de una sola manera: el rótulo lo
                  lleva el botón, no un `span` escondido al lado. */}
              <button
                className="dia-abre"
                aria-label={`${fmtDiaLargo(dia)}: ${titulo}, ${detalle}`}
                onClick={() => { tap(); setAbierto(dia) }}
              >
                <span className="dia-num" aria-hidden>
                  <b>{numero}</b><span>{semana}</span>
                </span>
                <span className="main">
                  <span className="n">{titulo}</span>
                  <span className="sub">{detalle}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {abierto && (
        <ModalDia
          eventId={eventId}
          event={event}
          dia={abierto}
          cena={cenas.find((c) => c.dia === abierto)}
          planes={planes}
          bungas={bungas}
          personas={personas}
          platos={platos}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

const etiquetaCategoria = (id) => DISH_CATEGORIES.find((c) => c.id === id)?.label ?? id

/**
 * El día, en su modal: **qué bungas, qué se cena y qué plan**.
 *
 * Un día no es una fila de la base —existe porque el evento tiene esas fechas—,
 * así que aquí no se crea ni se borra un día: se dice quién hace de anfitrión,
 * qué se cena y qué planes caen en él. Decidido en `docs/diseño/agenda-dia.html`
 * (B4 · F1 · G1 · C2 · D2 · E1); antes esto eran seis chips de platos, una
 * tarjeta para inventarse un plato al vuelo, dos textos largos y una alfombra de
 * nueve chips de planes: **1.773,8 pt** de modal, con el rótulo de los planes a
 * 994,8 del principio, o sea 218,8 por debajo de lo que se ve al abrir. Ahora son
 * cuatro renglones y **679,8 pt**: se abre y está todo.
 *
 * Las dos hojas no se comportan igual, y no es un descuido: los platos se
 * **marcan** —varios— y se guardan con el botón, como hasta ahora; un plan se
 * **elige** —uno— y se coloca en el acto, porque un plan no es de la cena y ya
 * se quitaba así.
 */
function ModalDia({ eventId, event, dia, cena, planes, bungas, personas, platos, onClose }) {
  useBloqueoDeScroll()
  const [mayores, setMayores] = useState(cena?.bungaMayoresId ?? bungas[0]?.id ?? '')
  const [ninos, setNinos] = useState(cena?.bungaNinosId ?? bungas[1]?.id ?? bungas[0]?.id ?? '')
  const [platoIds, setPlatoIds] = useState(() => new Set(cena?.platoIds ?? []))
  const [eligiendo, setEligiendo] = useState(null)

  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const elegidos = [...platoIds].map((id) => porId[id]).filter(Boolean)
  const delDia = planes.filter((p) => p.dia === dia)
  /**
   * Libres son los que no tienen día **y los que se quedaron fuera de las
   * fechas** (§14.10-quater · opción D2). Un plan cuyo día se cayó al acortar el
   * viaje no estaba ni en una lista ni en la otra: desaparecía del modal
   * mientras en Planes seguía apartado y marcado. Lo que cae fuera se aparta, no
   * se esconde.
   */
  const libres = planes.filter((p) => !p.dia || !dentroDeFechas(p.dia, event))

  function alternarPlato(id) {
    const s = new Set(platoIds); s.has(id) ? s.delete(id) : s.add(id); setPlatoIds(s)
  }

  async function guardar() {
    const campos = {
      bungaMayoresId: mayores || null,
      bungaNinosId: ninos || null,
      platoIds: [...platoIds],
    }
    if (cena) await updateDinner(cena.id, campos)
    else await addDinner(eventId, { dia, ...campos })
    onClose()
  }

  async function quitarCena() {
    if (cena) await removeDinner(cena.id)
    onClose()
  }

  const notaDePlan = (p) => (p.dia
    ? `era el ${fmtDiaCorto(p.dia)}, fuera del viaje`
    : `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`)

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2 className="modal-dia-t">{fmtDiaLargo(dia)}</h2>

        <div className="sec-h">La cena</div>
        <div className="grid2">
          <div>
            <label htmlFor="bunga-mayores">Bunga mayores</label>
            <select id="bunga-mayores" value={mayores} onChange={(e) => setMayores(e.target.value)}>
              <option value="">—</option>
              {bungas.map((b) => <option key={b.id} value={b.id}>{b.alias || b.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="bunga-ninos">Bunga niños</label>
            <select id="bunga-ninos" value={ninos} onChange={(e) => setNinos(e.target.value)}>
              <option value="">—</option>
              {bungas.map((b) => <option key={b.id} value={b.id}>{b.alias || b.name}</option>)}
            </select>
          </div>
        </div>

        <label>Qué se cena</label>
        <button
          type="button"
          className={`pastilla grande${elegidos.length ? '' : ' vacia'}`}
          onClick={() => { tap(); setEligiendo('platos') }}
        >
          {elegidos.length ? titularDeCena(cena ?? {}, elegidos) : '— elige los platos —'}
        </button>

        <div className="sec-h" style={{ marginTop: 18 }}>Los planes de este día</div>
        {delDia.length === 0 && <div className="apunte">Ninguno todavía.</div>}
        {delDia.map((p) => (
          <div className="row" key={p.id}>
            <div className="ico"><Icono nombre="plan" /></div>
            <div className="main"><div className="n">{p.titulo}</div></div>
            <button className="btn sm ghost" onClick={() => updatePlan(p.id, { dia: null })}>quitar</button>
          </div>
        ))}
        <button
          type="button"
          className="pastilla grande vacia"
          disabled={libres.length === 0}
          onClick={() => { tap(); setEligiendo('planes') }}
        >
          {libres.length === 0
            ? 'No queda ningún plan libre'
            : `+ Añadir un plan (${libres.length} ${libres.length === 1 ? 'libre' : 'libres'})`}
        </button>

        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar}>{cena ? 'Guardar la cena' : 'Montar la cena'}</button>
        </div>
        {cena && (
          <div style={{ marginTop: 10 }}>
            <button className="btn sm ghost danger-texto block" onClick={quitarCena}>Quitar la cena de este día</button>
          </div>
        )}

        {eligiendo === 'platos' && (
          <HojaDeMarcar
            titulo="Los platos de esta cena"
            opciones={platos.map((p) => ({
              id: p.id,
              etiqueta: `${p.name}${p.esFavorito ? ' ⭐' : ''}`,
              nota: etiquetaCategoria(p.categorias?.[0]),
            }))}
            marcados={platoIds}
            onAlternar={alternarPlato}
            onCerrar={() => setEligiendo(null)}
            vacio="El catálogo está vacío. Los platos se crean en Comidas → Platos."
            pie="Los platos se crean y se corrigen en Comidas → Platos."
          />
        )}

        {eligiendo === 'planes' && (
          <HojaDeEleccion
            titulo="Planes libres"
            opciones={libres.map((p) => ({ id: p.id, etiqueta: p.titulo, nota: notaDePlan(p) }))}
            valor={null}
            onElegir={async (id) => { await updatePlan(id, { dia }); setEligiendo(null) }}
            onCerrar={() => setEligiendo(null)}
          />
        )}
      </div>
    </div>
  )
}
