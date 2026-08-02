import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, updateDinner, removeDinner,
  plansOf, updatePlan, bungasOf, listDishes, addDish, DISH_CATEGORIES,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import {
  diasDe, resumenDeDia, numeroYDia, fmtDiaLargo, hoyISO,
} from '../lib/dias.js'

/**
 * «Días»: la lista de días del evento, con un resumen de cada uno y el botón
 * para editarlo.
 *
 * Opción **G1** de `docs/diseño/navegacion.html`: una fila por día, con el
 * número a la izquierda y el resumen en la línea de abajo. Es la misma `.row`
 * que ya usan Gastos y la Compra, y mide 70,7 pt: los ocho días de un viaje
 * entran de una vez en la pantalla y se ve de un vistazo cuál está libre. Una
 * tarjeta por día (G2) no cabía ni con los ocho vacíos.
 *
 * Y opción **H1** para abrirlo: el lápiz de 44 × 44 anuncia que el día se edita,
 * y tocar en cualquier otro sitio de la fila abre el mismo modal, así que no hay
 * que apuntar.
 */
export default function DiasScreen({ eventId, event }) {
  const cenas = useLiveQuery(() => dinnersOf(eventId), [eventId], [])
  const planes = useLiveQuery(() => plansOf(eventId), [eventId], [])
  const bungas = useLiveQuery(() => bungasOf(eventId), [eventId], [])
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
              {/* La fila entera abre, y el lápiz también: el botón está para
                  decir que el día se edita, no para tener que acertarle. */}
              <button className="dia-abre" onClick={() => { tap(); setAbierto(dia) }}>
                <span className="dia-num" aria-hidden>
                  <b>{numero}</b><span>{semana}</span>
                </span>
                <span className="main">
                  <span className="n">{titulo}</span>
                  <span className="sub">{detalle}</span>
                </span>
                <span className="sr-solo">{fmtDiaLargo(dia)}: {titulo}, {detalle}</span>
              </button>
              <button
                className="verbo-fila"
                aria-label={`Editar ${fmtDiaLargo(dia)}`}
                onClick={() => { tap(); setAbierto(dia) }}
              >
                <Icono nombre="lapiz" />
              </button>
            </div>
          )
        })}
      </div>

      {abierto && (
        <ModalDia
          eventId={eventId}
          dia={abierto}
          cena={cenas.find((c) => c.dia === abierto)}
          planes={planes}
          bungas={bungas}
          platos={platos}
          onClose={() => setAbierto(null)}
        />
      )}
    </div>
  )
}

/**
 * El día, en su modal.
 *
 * Un día no es una fila de la base —existe porque el evento tiene esas fechas—,
 * así que aquí no se crea ni se borra un día: se monta o se corrige **su cena** y
 * se dice **qué planes caen en él**. Son las dos únicas cosas que un día tiene.
 */
function ModalDia({ eventId, dia, cena, planes, bungas, platos, onClose }) {
  useBloqueoDeScroll()
  const [mayores, setMayores] = useState(cena?.bungaMayoresId ?? bungas[0]?.id ?? '')
  const [ninos, setNinos] = useState(cena?.bungaNinosId ?? bungas[1]?.id ?? bungas[0]?.id ?? '')
  const [platoIds, setPlatoIds] = useState(() => new Set(cena?.platoIds ?? []))
  const [queSeHace, setQueSeHace] = useState(cena?.queSeHace ?? '')
  const [cantidades, setCantidades] = useState(cena?.cantidades ?? '')
  const [nuevo, setNuevo] = useState('')
  const [nuevasCats, setNuevasCats] = useState(() => new Set())

  const delDia = planes.filter((p) => p.dia === dia)
  const sinDia = planes.filter((p) => !p.dia)

  function alternarPlato(id) {
    const s = new Set(platoIds); s.has(id) ? s.delete(id) : s.add(id); setPlatoIds(s)
  }
  function alternarCat(id) {
    const s = new Set(nuevasCats); s.has(id) ? s.delete(id) : s.add(id); setNuevasCats(s)
  }
  async function crearPlato() {
    if (!nuevo.trim() || nuevasCats.size === 0) return
    const id = await addDish({ name: nuevo.trim(), categorias: [...nuevasCats] }, event)
    setPlatoIds(new Set([...platoIds, id]))
    setNuevo(''); setNuevasCats(new Set())
  }

  async function guardar() {
    const campos = {
      bungaMayoresId: mayores || null,
      bungaNinosId: ninos || null,
      platoIds: [...platoIds],
      queSeHace: queSeHace.trim(),
      cantidades: cantidades.trim(),
    }
    if (cena) await updateDinner(cena.id, campos)
    else await addDinner(eventId, { dia, ...campos })
    onClose()
  }

  async function quitarCena() {
    if (cena) await removeDinner(cena.id)
    onClose()
  }

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

        <label>Platos <span className="apunte">(varios por tipo)</span></label>
        <div className="chips">
          {platos.map((p) => (
            <button
              key={p.id}
              className={`chip${platoIds.has(p.id) ? ' on' : ''}`}
              aria-pressed={platoIds.has(p.id)}
              onClick={() => alternarPlato(p.id)}
            >
              {p.name}{p.esFavorito ? ' ⭐' : ''}
            </button>
          ))}
          {platos.length === 0 && <span className="apunte">El catálogo está vacío — crea uno abajo.</span>}
        </div>

        <div className="card tight" style={{ marginTop: 10 }}>
          <label style={{ marginTop: 0 }}>Plato nuevo al vuelo</label>
          <input type="text" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Tortilla de patata" />
          <div className="chips" style={{ marginTop: 8 }}>
            {DISH_CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`chip${nuevasCats.has(c.id) ? ' on' : ''}`}
                aria-pressed={nuevasCats.has(c.id)}
                onClick={() => alternarCat(c.id)}
              >{c.label}</button>
            ))}
          </div>
          <button className="btn sm ghost" style={{ marginTop: 8 }} onClick={crearPlato}>+ añadir al catálogo</button>
        </div>

        <label>Qué se hace</label>
        <textarea rows={2} value={queSeHace} onChange={(e) => setQueSeHace(e.target.value)} placeholder="Quién cocina, preparación…" />
        <label>Cantidades</label>
        <textarea rows={2} value={cantidades} onChange={(e) => setCantidades(e.target.value)} placeholder="2 kg arroz · 30 mejillones…" />

        <div className="sec-h" style={{ marginTop: 18 }}>Los planes de este día</div>
        {delDia.length === 0 && <div className="apunte">Ninguno todavía.</div>}
        {delDia.map((p) => (
          <div className="row" key={p.id}>
            <div className="ico"><Icono nombre="plan" /></div>
            <div className="main"><div className="n">{p.titulo}</div></div>
            <button className="btn sm ghost" onClick={() => updatePlan(p.id, { dia: null })}>quitar del día</button>
          </div>
        ))}
        {sinDia.length > 0 && (
          <>
            <label>Planes sin día</label>
            <div className="chips">
              {sinDia.map((p) => (
                <button key={p.id} className="chip" onClick={() => updatePlan(p.id, { dia })}>
                  + {p.titulo}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn block" onClick={guardar}>{cena ? 'Guardar la cena' : 'Montar la cena'}</button>
        </div>
        {cena && (
          <div style={{ marginTop: 10 }}>
            <button className="btn sm ghost danger-texto block" onClick={quitarCena}>Quitar la cena de este día</button>
          </div>
        )}
      </div>
    </div>
  )
}
