import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  dinnersOf, addDinner, updateDinner, removeDinner,
  plansOf, updatePlan, bungasOf, familiesOf, personsOf, listDishes, DISH_CATEGORIES,
} from '../db.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { tap } from '../lib/native.js'
import Icono from '../components/Icono.jsx'
import { dentroDeFechas } from '../lib/evento.js'
import { votosDe, quienFaltaPorVotar } from '../lib/planes.js'
import {
  diasDe, resumenDeDia, numeroYDia, fmtDiaLargo, fmtDiaCorto, hoyISO, titularDeCena, enLetras,
  filtraOpciones,
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
  const familias = useLiveQuery(() => familiesOf(eventId), [eventId], [])
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
          familias={familias}
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
 * El día, abierto en el mueble de un plan: la capa centrada de
 * `plan-voto.html` · P1, en **tres secciones** —la cena, los bungas, el plan—
 * con un renglón por pregunta (`docs/diseño/elegidores.html` · S2, que revisa
 * el R2 de `dia-abierto.html`: los bungas salen de «La cena» y llevan dos
 * filas, para que cada selector sea una sola lista).
 *
 * **Cada renglón abre su elegidor en la misma capa** (V2): el día se aparta y
 * el elegidor ocupa el centro, solo — capa sobre capa se leía como un marco
 * doble, y la app no tiene esa figura—. Como el día ya no se ve detrás, el
 * elegidor lo lleva en su cabecera.
 *
 * **Y el elegidor trabaja sobre un borrador** (C2, la figura de la hoja de
 * «Entre», §14.27): tocar marca el borrador, «Listo» escribe todo junto y
 * «Cancelar» y el fondo descartan. Esto **revisa el H1 de §14.30** —cada toque
 * escribía— porque un «Cancelar» sin borrador es un verbo que miente: la regla
 * ahora cabe en una frase, dentro de un elegidor nada es definitivo hasta
 * «Listo». La capa del día sigue sin botón global: enseña lo guardado y punto.
 * La cena sigue naciendo sola con el primer «Listo» que la necesita, con la
 * guarda de `cenaRef` para que dos seguidos no críen dos cenas.
 */
function CapaDeDia({ eventId, event, dia, cena, planes, bungas, familias, personas, platos, onClose }) {
  useBloqueoDeScroll()
  const [eligiendo, setEligiendo] = useState(null)
  // La cena recién nacida, antes de que la consulta viva la traiga: sin esto,
  // dos «Listo» seguidos crearían dos cenas el mismo día.
  const cenaRef = useRef(null)

  const porId = Object.fromEntries(platos.map((p) => [p.id, p]))
  const elegidos = (cena?.platoIds ?? []).map((id) => porId[id]).filter(Boolean)
  const nPlatos = cena?.platoIds?.length ?? 0
  const delDia = planes.filter((p) => p.dia === dia)
  /**
   * Libres son los que no tienen día **y los que se quedaron fuera de las
   * fechas** (§14.10-quater · opción D2): lo que cae fuera se aparta, no se
   * esconde.
   */
  const libres = planes.filter((p) => !p.dia || !dentroDeFechas(p.dia, event))

  async function escribeCena(campos) {
    const id = cena?.id ?? cenaRef.current
    if (id) await updateDinner(id, campos)
    else cenaRef.current = await addDinner(eventId, { dia, ...campos })
  }

  async function quitarCena() {
    const id = cena?.id ?? cenaRef.current
    if (id) await removeDinner(id)
    cenaRef.current = null
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

  // El renglón de un bunga dice la casa y de quién es (elegidores.html · S2).
  // En masculino, que es como habla el grupo: «El del ruido», «+ Bunga nuevo…».
  const filaBunga = (id, quien) => {
    const b = bungas.find((x) => x.id === id)
    const f = b && familias.find((x) => x.id === b.familyId)
    return {
      elegido: Boolean(b),
      n: b ? `${quien} · ${b.alias || b.name}` : quien,
      s: b ? (f ? `el de los ${f.name}` : 'toca para cambiarlo') : 'toca para elegir el bunga',
    }
  }
  const may = filaBunga(cena?.bungaMayoresId, 'Mayores')
  const nin = filaBunga(cena?.bungaNinosId, 'Niños')

  const subCena = nPlatos
    ? (nPlatos === 1 ? 'un plato' : `${enLetras(nPlatos)} platos`)
    : 'toca para elegir los platos'
  const subPlanes = libres.length
    ? `${libres.length} ${libres.length === 1 ? 'plan libre' : 'planes libres'} por traer`
    : 'ningún plan libre — nacen en Planes'
  const sinNadaQueTraer = delDia.length === 0 && libres.length === 0

  // El fondo, con un elegidor abierto, es su «Cancelar»: descarta y vuelve al
  // día. Sin elegidor, cierra el día — que no tiene nada que perder (C2).
  const fondo = () => { if (eligiendo) setEligiendo(null); else onClose() }

  return (
    <div className="modal-bg center" onClick={fondo}>
      <div className="modal center formulario" onClick={(e) => e.stopPropagation()}>
        {!eligiendo && (
          <>
            <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
            <h2 className="modal-dia-t">{fmtDiaLargo(dia)}</h2>

            {/* El semáforo (dia-estado.html · E1 · K4 · G1): cada icono dice si
                su renglón ya tiene algo elegido. Verde de Planes; el vacío en
                ámbar —pendiente—, no en rojo, que aquí significa deuda. */}
            <div className="sec-h" style={{ marginTop: 10 }}>La cena</div>
            <div className="card tight" style={{ marginTop: 6 }}>
              <button className="row fila-boton fila-capa" onClick={() => { tap(); setEligiendo('platos') }}>
                <div className={`ico ${nPlatos ? 'verde' : 'ambar'}`}><Icono nombre="restaurante" /></div>
                <div className="main">
                  <div className="n">{titularDeCena(cena ?? null, elegidos)}</div>
                  <div className="sub">{subCena}</div>
                </div>
              </button>
            </div>

            <div className="sec-h" style={{ marginTop: 6 }}>Los bungas</div>
            <div className="card tight" style={{ marginTop: 6 }}>
              <button className="row fila-boton fila-capa" onClick={() => { tap(); setEligiendo('mayores') }}>
                <div className={`ico ${may.elegido ? 'verde' : 'ambar'}`}><Icono nombre="casa" /></div>
                <div className="main">
                  <div className="n">{may.n}</div>
                  <div className="sub">{may.s}</div>
                </div>
              </button>
              <button className="row fila-boton fila-capa" onClick={() => { tap(); setEligiendo('ninos') }}>
                <div className={`ico ${nin.elegido ? 'verde' : 'ambar'}`}><Icono nombre="casa" /></div>
                <div className="main">
                  <div className="n">{nin.n}</div>
                  <div className="sub">{nin.s}</div>
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
                <div className={`ico ${delDia.length ? 'verde' : 'ambar'}`}><Icono nombre="plan" /></div>
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
              Cada renglón abre su elegidor, y nada cambia hasta su <b>«Listo»</b>. Los planes se
              <b> votan</b> en Planes; aquí se colocan.
            </div>
          </>
        )}

        {eligiendo === 'platos' && (
          <ElegidorDePlatos
            dia={dia}
            platos={platos}
            inicial={cena?.platoIds ?? []}
            hayCena={Boolean(cena || cenaRef.current)}
            onQuitarCena={quitarCena}
            onCancelar={() => setEligiendo(null)}
            onListo={async (ids) => {
              // Sin cena y sin nada marcado no hay nada que escribir: un
              // «Listo» vacío no cría una cena vacía. Y un «Listo» sin cambios
              // no encola un cambio que no cambia nada.
              const antes = cena?.platoIds ?? []
              const igual = ids.length === antes.length && ids.every((x) => antes.includes(x))
              if (!igual && (ids.length > 0 || cena || cenaRef.current)) await escribeCena({ platoIds: ids })
              setEligiendo(null)
            }}
          />
        )}

        {(eligiendo === 'mayores' || eligiendo === 'ninos') && (
          <ElegidorDeBunga
            titulo={eligiendo === 'mayores' ? 'Bunga mayores' : 'Bunga niños'}
            dia={dia}
            bungas={bungas}
            familias={familias}
            inicial={(eligiendo === 'mayores' ? cena?.bungaMayoresId : cena?.bungaNinosId) ?? null}
            onCancelar={() => setEligiendo(null)}
            onListo={async (id) => {
              const campo = eligiendo === 'mayores' ? 'bungaMayoresId' : 'bungaNinosId'
              const antes = (eligiendo === 'mayores' ? cena?.bungaMayoresId : cena?.bungaNinosId) ?? null
              // «Ninguna» en un día sin cena no cría una cena vacía, y repetir
              // lo puesto no encola nada.
              if (id !== antes && (id !== null || cena || cenaRef.current)) await escribeCena({ [campo]: id })
              setEligiendo(null)
            }}
          />
        )}

        {eligiendo === 'planes' && (
          <ElegidorDePlanes
            dia={dia}
            delDia={delDia}
            libres={libres}
            notaDePlan={notaDePlan}
            onCancelar={() => setEligiendo(null)}
            onListo={async (ids) => {
              // El diff contra lo guardado: lo desmarcado vuelve a libres y lo
              // marcado nuevo se coloca. Lo que no cambió no se toca — no se
              // encolan cambios que no cambian nada.
              for (const p of delDia) if (!ids.has(p.id)) await updatePlan(p.id, { dia: null })
              for (const p of libres) if (ids.has(p.id)) await updatePlan(p.id, { dia })
              setEligiendo(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * El armazón de un elegidor (`elegidores.html` · C2 · V2): sustituye al día en
 * la misma capa, lleva el día en su cabecera —ya no se ve detrás— y sale por
 * los dos verbos de siempre, abajo y en azul (§14.27-bis): «Cancelar» descarta
 * y «Listo» confirma. El borrador vive en el elegidor concreto; desmontarlo es
 * descartarlo, así que el fondo cancela gratis.
 */
function Elegidor({ titulo, dia, buscador = null, onCancelar, onListo, children }) {
  return (
    <>
      <h2>{titulo}</h2>
      <div className="pista">{fmtDiaLargo(dia)}</div>
      {buscador}
      {children}
      <div className="salida">
        <button type="button" className="btn ghost" onClick={() => { tap(); onCancelar() }}>Cancelar</button>
        <button type="button" className="btn" onClick={() => { tap(); onListo() }}>Listo</button>
      </div>
    </>
  )
}

/**
 * El campo de buscar, siempre a la vista (`elegidores.html` · L3) y **sin robar
 * el foco** (§14.24): el teclado no sale hasta tocarlo. Lo llevan los
 * elegidores de platos y de planes; el de bungas no (L1) — tres casas no se
 * buscan.
 */
function Buscador({ valor, onCambio, etiqueta }) {
  return (
    <input
      type="search"
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      placeholder="Buscar…"
      aria-label={etiqueta}
      style={{ marginTop: 10 }}
    />
  )
}

function ElegidorDePlatos({ dia, platos, inicial, hayCena, onQuitarCena, onCancelar, onListo }) {
  const [marcados, setMarcados] = useState(() => new Set(inicial))
  const [busca, setBusca] = useState('')
  const [quitando, setQuitando] = useState(false)

  const opciones = platos.map((p) => ({
    id: p.id,
    etiqueta: `${p.name}${p.esFavorito ? ' ⭐' : ''}`,
    nota: etiquetaCategoria(p.categorias?.[0]),
  }))
  const visibles = filtraOpciones(opciones, busca)

  function alternar(id) {
    const s = new Set(marcados)
    s.has(id) ? s.delete(id) : s.add(id)
    setMarcados(s)
  }

  return (
    <Elegidor
      titulo="Los platos de esta cena"
      dia={dia}
      buscador={<Buscador valor={busca} onCambio={setBusca} etiqueta="Buscar un plato" />}
      onCancelar={onCancelar}
      onListo={() => onListo([...marcados])}
    >
      {platos.length === 0 && (
        <div className="note" style={{ marginTop: 10 }}>
          El catálogo está vacío. Los platos se crean en Comidas → Platos.
        </div>
      )}
      {platos.length > 0 && visibles.length === 0 && (
        <div className="apunte" style={{ marginTop: 10 }}>Ningún plato se llama así.</div>
      )}
      {visibles.length > 0 && (
        <div className="eleccion">
          {visibles.map((o) => (
            <button
              key={o.id}
              type="button"
              className="eleccion-op"
              aria-pressed={marcados.has(o.id)}
              onClick={() => { tap(); alternar(o.id) }}
            >
              <span className="et">{o.etiqueta}</span>
              {o.nota && <span className="no">{o.nota}</span>}
              {marcados.has(o.id) && <span className="tic"><Icono nombre="visto" /></span>}
            </button>
          ))}
        </div>
      )}
      <div className="apunte" style={{ marginTop: 10 }}>
        Los platos se crean y se corrigen en Comidas → Platos.
      </div>
      {/* Quitar la cena vive aquí, con segunda pulsación (dia-abierto.html ·
          H1). Es la única salida del elegidor que escribe sin «Listo»: es un
          verbo con su propia confirmación, no parte del borrador. */}
      {hayCena && (quitando ? (
        <div style={{ marginTop: 10 }}>
          <div className="note">
            Se lleva los platos y las bungas de este día. Los planes se quedan.
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm danger" onClick={() => { tap(); onQuitarCena() }}>Sí, quitarla</button>
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
    </Elegidor>
  )
}

/**
 * Un bunga, una lista (`elegidores.html` · S2 · B1): la familia manda y el
 * alias queda de seña — «¿cuál era el de los Pérez?» se contesta sin saberse
 * los motes—. Un bunga sin familia dueña se queda con su alias. Sin buscador
 * (L1): tres casas no se buscan.
 */
function ElegidorDeBunga({ titulo, dia, bungas, familias, inicial, onCancelar, onListo }) {
  const [valor, setValor] = useState(inicial)

  const opciones = [
    { id: null, etiqueta: 'Ninguno', nota: null },
    ...bungas.map((b) => {
      const f = familias.find((x) => x.id === b.familyId)
      return f
        ? { id: b.id, etiqueta: f.name, nota: b.alias || b.name }
        : { id: b.id, etiqueta: b.alias || b.name, nota: null }
    }),
  ]

  return (
    <Elegidor titulo={titulo} dia={dia} onCancelar={onCancelar} onListo={() => onListo(valor)}>
      <div className="eleccion" style={{ marginTop: 12 }}>
        {opciones.map((o) => (
          <button
            key={o.id ?? 'ninguna'}
            type="button"
            className="eleccion-op"
            onClick={() => { tap(); setValor(o.id) }}
          >
            <span className="et">{o.etiqueta}</span>
            {o.nota && <span className="no">{o.nota}</span>}
            {(o.id ?? null) === (valor ?? null) && <span className="tic"><Icono nombre="visto" /></span>}
          </button>
        ))}
      </div>
    </Elegidor>
  )
}

function ElegidorDePlanes({ dia, delDia, libres, notaDePlan, onCancelar, onListo }) {
  const [marcados, setMarcados] = useState(() => new Set(delDia.map((p) => p.id)))
  const [busca, setBusca] = useState('')

  const todos = [...delDia, ...libres]
  const opciones = todos.map((p) => ({ id: p.id, etiqueta: p.titulo, nota: notaDePlan(p) }))
  const visibles = filtraOpciones(opciones, busca)

  function alternar(id) {
    const s = new Set(marcados)
    s.has(id) ? s.delete(id) : s.add(id)
    setMarcados(s)
  }

  return (
    <Elegidor
      titulo="Los planes de este día"
      dia={dia}
      buscador={<Buscador valor={busca} onCambio={setBusca} etiqueta="Buscar un plan" />}
      onCancelar={onCancelar}
      onListo={() => onListo(marcados)}
    >
      {todos.length > 0 && visibles.length === 0 && (
        <div className="apunte" style={{ marginTop: 10 }}>Ningún plan se llama así.</div>
      )}
      {visibles.length > 0 && (
        <div className="eleccion nota-debajo">
          {visibles.map((o) => (
            <button
              key={o.id}
              type="button"
              className="eleccion-op"
              aria-pressed={marcados.has(o.id)}
              onClick={() => { tap(); alternar(o.id) }}
            >
              <span className="et">{o.etiqueta}</span>
              {o.nota && <span className="no">{o.nota}</span>}
              {marcados.has(o.id) && <span className="tic"><Icono nombre="visto" /></span>}
            </button>
          ))}
        </div>
      )}
      <div className="apunte" style={{ marginTop: 10 }}>
        Marcar lo pone en este día; desmarcar lo devuelve a libres.
      </div>
    </Elegidor>
  )
}
