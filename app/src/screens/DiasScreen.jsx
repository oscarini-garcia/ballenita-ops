import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, updateDinner, removeDinner,
  plansOf, updatePlan, bungasOf, personsOf, listDishes, DISH_CATEGORIES,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import Hoja, { HojaDeMarcar } from '../components/Hoja.jsx'
import { dentroDeFechas } from '../lib/evento.js'
import { votosDe, quienFaltaPorVotar } from '../lib/planes.js'
import {
  diasDe, resumenDeDia, numeroYDia, fmtDiaLargo, fmtDiaCorto, hoyISO, titularDeCena, enLetras,
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
        <CapaDeDia
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
 * El día, abierto **en el mismo mueble que un plan**: la capa centrada de
 * `plan-voto.html` · P1, con tres renglones gemelos que abren hojas
 * (`docs/diseño/dia-abierto.html` · M2 · R2). Antes era un formulario pegado
 * abajo con seis controles de cuatro figuras distintas —dos selectores nativos,
 * dos pastillas y dos botones— y las dos únicas cosas de la app que se abren
 * para leerse y tocarse no compartían ni la posición ni las figuras.
 *
 * **Todo escribe al toque, como votar** (H1): la bunga al elegirla, el plato al
 * marcarlo, el plan al ponerlo. No hay botón de guardar —«Guardar la cena»
 * guardaba también las bungas y no tocaba los planes, que ya se guardaban
 * solos— y cerrar nunca pierde nada: antes los platos y las bungas vivían en un
 * borrador que moría con la X mientras los planes ya estaban escritos, dos
 * memorias detrás de una ventana. La cena **nace sola** con el primer plato o
 * la primera bunga, y quitarla es un verbo dentro de su hoja, con segunda
 * pulsación, como «Devolver a ideas».
 *
 * Los tres renglones abren la misma figura: los platos y los planes se
 * **marcan** (`HojaDeMarcar` — en la de planes, marcar pone el plan en el día y
 * desmarcar lo devuelve a libres, así que el «quitar» que vivía dentro de la
 * fila sobra), y las bungas se **eligen** en una hoja con las dos listas.
 */
function CapaDeDia({ eventId, event, dia, cena, planes, bungas, personas, platos, onClose }) {
  useBloqueoDeScroll()
  const [eligiendo, setEligiendo] = useState(null)
  const [quitando, setQuitando] = useState(false)
  // La cena recién nacida, antes de que la consulta viva la traiga: sin esto,
  // dos toques rápidos crearían dos cenas el mismo día.
  const cenaRef = useRef(null)
  // El espejo local de lo marcado y lo elegido: la interfaz responde al dedo,
  // no a la vuelta de la consulta, y cada toque escribe además en la base.
  const [platoIds, setPlatoIds] = useState(() => new Set(cena?.platoIds ?? []))
  const [mayores, setMayores] = useState(cena?.bungaMayoresId ?? null)
  const [ninos, setNinos] = useState(cena?.bungaNinosId ?? null)

  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const elegidos = [...platoIds].map((id) => porId[id]).filter(Boolean)
  const delDia = planes.filter((p) => p.dia === dia)
  /**
   * Libres son los que no tienen día **y los que se quedaron fuera de las
   * fechas** (§14.10-quater · opción D2): lo que cae fuera se aparta, no se
   * esconde.
   */
  const libres = planes.filter((p) => !p.dia || !dentroDeFechas(p.dia, event))
  const nombreBunga = (id) => { const b = bungas.find((x) => x.id === id); return b ? (b.alias || b.name) : null }

  const hayCena = Boolean(cena || cenaRef.current)

  async function escribeCena(campos) {
    const id = cena?.id ?? cenaRef.current
    if (id) await updateDinner(id, campos)
    else cenaRef.current = await addDinner(eventId, { dia, ...campos })
  }

  function alternarPlato(id) {
    const s = new Set(platoIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setPlatoIds(s)
    escribeCena({ platoIds: [...s] })
  }

  function ponBunga(campo, id) {
    if (campo === 'bungaMayoresId') setMayores(id)
    else setNinos(id)
    escribeCena({ [campo]: id })
  }

  function alternarPlan(id) {
    const p = planes.find((x) => x.id === id)
    updatePlan(id, { dia: p?.dia === dia ? null : dia })
  }

  async function quitarCena() {
    const id = cena?.id ?? cenaRef.current
    if (id) await removeDinner(id)
    cenaRef.current = null
    setPlatoIds(new Set())
    setMayores(null)
    setNinos(null)
    setQuitando(false)
    setEligiendo(null)
  }

  const notaDePlan = (p) => {
    if (p.dia === dia) {
      return p.estado === 'confirmado' ? 'Confirmado'
        : `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`
    }
    if (p.dia) return `era el ${fmtDiaCorto(p.dia)}, fuera del viaje`
    return `${votosDe(p)} 👍 · ${quienFaltaPorVotar(p, personas)}`
  }

  const nMay = nombreBunga(mayores)
  const nNin = nombreBunga(ninos)
  // «un plato», no «una plato»: la letra de LETRAS es femenina («una cosa más»).
  const subCena = platoIds.size
    ? (platoIds.size === 1 ? 'un plato' : `${enLetras(platoIds.size)} platos`)
    : 'toca para elegir los platos'
  const subPlanes = libres.length
    ? `${libres.length} ${libres.length === 1 ? 'plan libre' : 'planes libres'} por traer`
    : 'ningún plan libre — nacen en Planes'
  const sinNadaQueTraer = delDia.length === 0 && libres.length === 0

  return (
    <div className="modal-bg center" onClick={onClose}>
      <div className="modal center formulario" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        <h2 className="modal-dia-t">{fmtDiaLargo(dia)}</h2>

        <div className="sec-h" style={{ marginTop: 10 }}>La cena</div>
        <div className="card tight" style={{ marginTop: 6 }}>
          <button className="row fila-boton fila-capa" onClick={() => { tap(); setEligiendo('platos') }}>
            <div className="ico"><Icono nombre="restaurante" /></div>
            <div className="main">
              <div className="n">{titularDeCena(hayCena ? { platoIds: [...platoIds] } : null, elegidos)}</div>
              <div className="sub">{subCena}</div>
            </div>
          </button>
          <button className="row fila-boton fila-capa" onClick={() => { tap(); setEligiendo('bungas') }}>
            <div className="ico"><Icono nombre="casa" /></div>
            <div className="main">
              <div className="n">{nMay ? `Mayores en ${nMay}` : 'Sin bungas repartidas'}</div>
              <div className="sub">
                {nNin ? `niños en ${nNin}` : (nMay ? 'niños sin bunga' : '¿dónde cenan mayores y niños?')}
              </div>
            </div>
          </button>
        </div>

        <div className="sec-h" style={{ marginTop: 6 }}>El plan</div>
        <div className="card tight" style={{ marginTop: 6 }}>
          <button
            className="row fila-boton fila-capa"
            disabled={sinNadaQueTraer}
            onClick={() => { tap(); setEligiendo('planes') }}
          >
            <div className="ico"><Icono nombre="plan" /></div>
            <div className="main">
              <div className="n">
                {delDia.length === 0 ? 'Nada apuntado'
                  : delDia.length === 1 ? delDia[0].titulo
                    : `${delDia[0].titulo} y ${delDia.length === 2 ? 'otro más' : `${enLetras(delDia.length - 1)} más`}`}
              </div>
              <div className="sub">{delDia.length === 1 ? notaDePlan(delDia[0]) : subPlanes}</div>
            </div>
          </button>
        </div>

        <div className="note" style={{ marginTop: 12 }}>
          Cada toque queda guardado. Los planes se <b>votan</b> en Planes; aquí se colocan.
        </div>

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
            onCerrar={() => { setQuitando(false); setEligiendo(null) }}
            vacio="El catálogo está vacío. Los platos se crean en Comidas → Platos."
            pie="Cada plato se guarda al marcarlo. Se crean y se corrigen en Comidas → Platos."
          >
            {hayCena && (quitando ? (
              <div style={{ marginTop: 10 }}>
                <div className="note">
                  Se lleva los platos y las bungas de este día. Los planes se quedan.
                </div>
                <div className="chips" style={{ marginTop: 8 }}>
                  <button type="button" className="btn sm danger" onClick={() => { tap(); quitarCena() }}>Sí, quitarla</button>
                  <button type="button" className="btn sm ghost" onClick={() => setQuitando(false)}>Dejarla</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn sm ghost danger-texto block"
                  onClick={() => { tap(); setQuitando(true) }}
                >
                  Quitar la cena de este día
                </button>
              </div>
            ))}
          </HojaDeMarcar>
        )}

        {eligiendo === 'bungas' && (
          <HojaDeBungas
            bungas={bungas}
            mayores={mayores}
            ninos={ninos}
            onElegir={ponBunga}
            onCerrar={() => setEligiendo(null)}
          />
        )}

        {eligiendo === 'planes' && (
          <HojaDeMarcar
            titulo="Los planes de este día"
            notaDebajo
            opciones={[...delDia, ...libres].map((p) => ({ id: p.id, etiqueta: p.titulo, nota: notaDePlan(p) }))}
            marcados={new Set(delDia.map((p) => p.id))}
            onAlternar={alternarPlan}
            onCerrar={() => setEligiendo(null)}
            pie="Marcar pone el plan en este día; desmarcar lo devuelve a libres."
          />
        )}
      </div>
    </div>
  )
}

/**
 * Las dos bungas de la cena, en una hoja con las dos listas (R2). Sustituye a
 * los dos selectores nativos: la rueda de iOS tapa media pantalla —el motivo
 * por el que `agenda-dia.html` · C1 la descartó para los planes valía igual
 * aquí— y la hoja es la figura de elegir de toda la app. Cada elección escribe
 * al soltarla (H1) y la hoja no se cierra: son dos preguntas y se contestan
 * seguidas; «Listo» es la salida escrita, como en la de marcar.
 */
function HojaDeBungas({ bungas, mayores, ninos, onElegir, onCerrar }) {
  const lista = (valor, campo) => (
    <div className="eleccion">
      {[{ id: null, etiqueta: 'Ninguna' }, ...bungas.map((b) => ({ id: b.id, etiqueta: b.alias || b.name }))]
        .map((o) => (
          <button
            key={o.id ?? 'ninguna'}
            type="button"
            className="eleccion-op"
            onClick={() => { tap(); onElegir(campo, o.id) }}
          >
            <span className="et">{o.etiqueta}</span>
            {(o.id ?? null) === (valor ?? null) && <span className="tic"><Icono nombre="visto" /></span>}
          </button>
        ))}
    </div>
  )
  return (
    <Hoja titulo="Dónde se cena" onCerrar={onCerrar}>
      <label>Bunga mayores</label>
      {lista(mayores, 'bungaMayoresId')}
      <label>Bunga niños</label>
      {lista(ninos, 'bungaNinosId')}
      <div className="apunte" style={{ marginTop: 10 }}>Cada elección se guarda al tocarla.</div>
      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn block" onClick={() => { tap(); onCerrar() }}>Listo</button>
      </div>
    </Hoja>
  )
}
