import { useState } from 'react'
import { addExpense, updateExpense, anclaDe } from '../db.js'
import { centsToEuros, formatCents } from '../lib/money.js'
import { now } from '../lib/ids.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { useIdentidad } from '../lib/identidad.js'
import { CATEGORIES, catOf } from '../lib/categorias.js'
import { IMPORTE_VACIO, desdeCents, totalCents, guardable, enPalabras } from '../lib/importe.js'
import { splitCents } from '../lib/reparto.js'
import { comoSeReparte } from '../lib/reparto-gente.js'
import Comentarios from '../components/Comentarios.jsx'
import PadDeImporte from '../components/PadDeImporte.jsx'
import { HojaDeEleccion } from '../components/Hoja.jsx'
import HojaDeEntre from './HojaDeEntre.jsx'
import Icono from '../components/Icono.jsx'
import { tap } from '../lib/native.js'

// ─────────────────────────────────────────────────────────────────────────────
// La ficha de un gasto (SPECS §14.26 · `docs/diseño/gasto-nuevo.html`,
// combinación A1 · B3 · C1 · D2 · E2).
//
// La de antes medía 830,6 pt en un teléfono de 844, salía como hoja desde abajo
// y abría el teclado alfabético sola: con el teclado puesto quedaban 508 pt de
// ventana, o sea que se veía el 61 % y había que hacer scroll dentro de un modal
// para llegar a Guardar. Y lo que se viene a hacer aquí —apuntar «24,30 de hielo
// y birras» con el carro en la mano— son dos datos: cuánto y de qué.
//
// Ahora son dos pantallas. La **rápida** mide siempre lo mismo (633,6 pt sobre
// un tope de 658), no abre teclado del sistema nunca y lleva el importe, la
// categoría y los dos valores por defecto a la vista. **Detalles** es una capa
// aparte con lo que casi nunca se toca —la descripción, la fecha, la moneda y el
// reparto fino—, y ahí sí puede salir el teclado, que es lo suyo cuando se
// escribe una palabra sentado.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El renglón «Entre» de la ficha, que a diferencia de la fila de la lista **sí
 * dice el caso normal**: ahí no enseñar nada se leería como que no hay valor.
 */
function resumenDeEntre(estado, persons) {
  const raro = comoSeReparte(estado, persons)
  if (raro) return raro
  return `todos (${persons.length})`
}

/**
 * En modo «importes», la última familia lleva lo que falte.
 *
 * Se aplica al teclear **y otra vez al guardar**, porque entre una cosa y la
 * otra se puede volver al pad y cambiar el total: sin esta segunda pasada, un
 * gasto corregido de 24,30 a 26,40 se guardaría repartiendo 24,30.
 */
export function cuadrar(porFamilia, families, total) {
  const ultima = families.at(-1)
  if (!ultima) return { modo: 'importes', porFamilia }
  const antes = families
    .slice(0, -1)
    .reduce((s, f) => s + Math.max(0, Number(porFamilia[f.id]) || 0), 0)
  return {
    modo: 'importes',
    porFamilia: { ...porFamilia, [ultima.id]: Math.max(0, total - antes) },
  }
}

/** `dateISO` ↔ el valor que quiere un `<input type="datetime-local">` (hora local). */
function aLocal(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function deLocal(valor, siFalla) {
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? siFalla : d.toISOString()
}

export default function FichaDeGasto({ event, eventId, families, persons, gasto, onClose }) {
  useBloqueoDeScroll()
  const editando = Boolean(gasto)
  const { me } = useIdentidad(eventId, persons)
  // Dexie las devuelve en el orden en que caen los ids, o sea al azar: en un
  // móvil salía «García, Pérez» y en otro al revés, y con el reparto por
  // importes eso importa —la última es la que lleva lo que falte—. Por nombre.
  const familias = [...families].sort((a, b) => a.name.localeCompare(b.name, 'es'))

  const [importe, setImporte] = useState(() => (
    gasto ? desdeCents(Math.round((gasto.amountOriginal ?? centsToEuros(gasto.amountCents)) * 100)) : IMPORTE_VACIO
  ))
  const [category, setCategory] = useState(gasto?.category ?? 'compra_general')
  // El pagador por defecto era `families[0]`, o sea la primera que devolviera
  // Dexie, y la app **ya sabe quién eres** (`lib/identidad.js`, el badge de la
  // cabecera). Ahora paga tu familia; si no has dicho quién eres, la primera por
  // nombre, que al menos es la misma en todos los móviles.
  const [payerFamily, setPayerFamily] = useState(
    gasto?.payers?.[0]?.familyId ?? me?.familyId ?? familias[0]?.id ?? '',
  )
  const [participantIds, setParticipantIds] = useState(
    () => gasto?.participantIds ?? persons.map((p) => p.id),
  )
  const [reparto, setReparto] = useState(gasto?.reparto ?? null)
  const [description, setDescription] = useState(gasto?.description ?? '')
  const [dateISO, setDateISO] = useState(gasto?.dateISO ?? now())
  const [currency, setCurrency] = useState(gasto?.currency ?? event.currency)
  const [rate, setRate] = useState(gasto?.rate ?? 1)

  // Qué hoja hay abierta encima: 'detalles' | 'paga' | 'entre' | null.
  const [encima, setEncima] = useState(null)

  const differsCurrency = currency !== event.currency
  const centsTecleados = totalCents(importe)
  const sePuede = guardable(importe) && payerFamily && (participantIds.length > 0 || reparto)
  const estado = { reparto, participantIds }

  async function guardar() {
    if (!sePuede) return
    tap()
    const amountCents = differsCurrency ? Math.round(centsTecleados * Number(rate)) : centsTecleados
    const datos = {
      description: description.trim(),
      amountCents,
      currency,
      amountOriginal: centsToEuros(centsTecleados),
      rate: differsCurrency ? Number(rate) : 1,
      category,
      payers: [{ familyId: payerFamily, amountCents }],
      participantIds,
      // Lo de siempre no se guarda: un `reparto` nulo **es** el reparto por
      // pesos, y así los gastos ya apuntados se quedan exactamente como están.
      reparto: reparto?.modo === 'importes'
        ? cuadrar(reparto.porFamilia, familias, centsTecleados)
        : (reparto?.modo === 'partes' ? reparto : null),
    }
    // Al corregir se conserva la fecha original salvo que se cambie a mano: es
    // cuándo se gastó, no cuándo se cayó en la cuenta de que estaba mal apuntado.
    if (editando) await updateExpense(gasto.id, { ...datos, dateISO })
    else await addExpense(eventId, { ...datos, dateISO })
    onClose()
  }

  return (
    <>
      <div className="modal-bg center" onClick={onClose}>
        <div
          className="modal center formulario ficha-gasto"
          role="dialog"
          aria-modal="true"
          aria-label={editando ? 'Corregir gasto' : 'Nuevo gasto'}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sin título: el título de esta ficha es la cifra, y quitarlo es lo
              que dejó sitio para que el pad y el botón convivan sin scroll. */}
          <div className="cab-fina">
            <button type="button" className="x" onClick={onClose} aria-label="Cerrar">×</button>
          </div>

          <PadDeImporte importe={importe} onCambio={setImporte} moneda={currency} />

          <div className="cats" role="group" aria-label="Categoría">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat${category === c.id ? ' on' : ''}`}
                data-cat={c.tono}
                aria-pressed={category === c.id}
                onClick={() => { tap(); setCategory(c.id) }}
              >
                <Icono nombre={c.icon} />
                {c.corto}
              </button>
            ))}
          </div>

          {/* C1 · los dos valores por defecto dicen lo que se va a guardar sin
              abrir nada, y se tocan para cambiarlo. Lo que no se ve, no se
              corrige: un valor por defecto invisible se lee como que no hay. */}
          <div className="caja-reng">
            <button type="button" className="reng" onClick={() => { tap(); setEncima('paga') }}>
              <span className="k">Paga</span>
              <span className="v">
                {familias.find((f) => f.id === payerFamily)?.name ?? '—'}
                <span className="fle" aria-hidden="true">›</span>
              </span>
            </button>
            <button type="button" className="reng" onClick={() => { tap(); setEncima('entre') }}>
              <span className="k">Entre</span>
              <span className="v">
                {resumenDeEntre(estado, persons)}
                <span className="fle" aria-hidden="true">›</span>
              </span>
            </button>
            {/* «Detalles» vivía arriba, a la izquierda del aspa, y ahí era un
                renglón de cromo antes de la cifra. Aquí es lo que es: el último
                renglón del formulario, hermano de «Paga» y «Entre» —los tres
                abren su pantalla— y en el orden en que se rellenan. */}
            <button type="button" className="reng" onClick={() => { tap(); setEncima('detalles') }}>
              <span className="k">Detalles</span>
              <span className={`v${description.trim() ? '' : ' vacio'}`}>
                <span className="t">{description.trim() || 'descripción, fecha, reparto…'}</span>
                <span className="fle" aria-hidden="true">›</span>
              </span>
            </button>
          </div>

          <button type="button" className="btn block guardar-gasto" disabled={!sePuede} onClick={guardar}>
            {editando ? 'Guardar los cambios' : 'Guardar gasto'}
          </button>

          {/* **El hilo, solo en un gasto que ya existe** (§14.55). Es el segundo
              sitio donde un comentario pide salir y probablemente el más útil:
              «¿esto qué era?» es la pregunta que más se hace al repasar cuentas,
              y hasta hoy la única respuesta posible era la descripción, que la
              escribió quien lo apuntó y no quien pregunta. En uno que aún no se
              ha guardado no sale: no tiene id al que anclar el hilo. */}
          {editando && <Comentarios eventId={eventId} ancla={anclaDe('gasto', gasto.id)} titulo="Comentarios del gasto" />}
          {!guardable(importe) && (
            <div className="pista pista-gasto">Teclea el importe y se enciende.</div>
          )}
        </div>
      </div>

      {encima === 'paga' && (
        <HojaDeEleccion
          titulo="Quién paga"
          opciones={familias.map((f) => ({ id: f.id, etiqueta: f.name }))}
          valor={payerFamily}
          onElegir={(id) => { setPayerFamily(id); setEncima(null) }}
          onCerrar={() => setEncima(null)}
        />
      )}

      {encima === 'entre' && (
        <HojaDeEntre
          persons={persons}
          families={familias}
          participantIds={participantIds}
          onCambio={setParticipantIds}
          onCerrar={() => setEncima(null)}
        />
      )}

      {encima === 'detalles' && (
        <DetallesDeGasto
          event={event}
          families={familias}
          totalCents={centsTecleados}
          description={description} setDescription={setDescription}
          dateISO={dateISO} setDateISO={setDateISO}
          currency={currency} setCurrency={setCurrency}
          rate={rate} setRate={setRate}
          reparto={reparto} setReparto={setReparto}
          onCerrar={() => setEncima(null)}
        />
      )}
    </>
  )
}

/**
 * Detalles (D2): una capa entera sobre la ficha, con lo que casi nunca se toca.
 *
 * Va en capa y no en acordeón porque la ficha rápida tiene que medir **siempre
 * lo mismo**: es lo que permite aprender dónde cae cada tecla sin mirar. Un
 * acordeón la llevaría de 633,6 a 1.229,7 pt y empujaría el pad fuera de la
 * vista mientras escribes.
 *
 * Aquí sí hay teclado del sistema, y está bien: es un formulario largo que se
 * rellena sentado. Lo que no hay es `autoFocus` — el teclado no sale hasta tocar
 * un campo, como en el editor de una idea (§14.24).
 */
export function DetallesDeGasto({
  event, families, totalCents: total,
  description, setDescription, dateISO, setDateISO,
  currency, setCurrency, rate, setRate, reparto, setReparto, onCerrar,
}) {
  useBloqueoDeScroll()
  const modo = reparto?.modo ?? 'pesos'
  const porFamilia = reparto?.porFamilia ?? {}

  function cambiarModo(nuevo) {
    tap()
    if (nuevo === 'pesos') return setReparto(null)
    if (nuevo === 'partes') {
      return setReparto({ modo: 'partes', porFamilia: Object.fromEntries(families.map((f) => [f.id, 1])) })
    }
    // Al entrar en «Importes» se propone el reparto a partes iguales ya hecho:
    // una pantalla de ceros obliga a teclear tres números para no cambiar nada.
    const trozos = splitCents(total, families.map((f) => ({ id: f.id, weight: 1 })))
    return setReparto({ modo: 'importes', porFamilia: Object.fromEntries(families.map((f) => [f.id, trozos.get(f.id) ?? 0])) })
  }

  // En «Importes» el último renglón **no se teclea**: lleva lo que falte. Así no
  // se puede guardar un gasto descuadrado, que es la única forma de que la suma
  // de los saldos deje de dar cero. Y ninguno de los otros puede pasarse del
  // total, porque entonces «lo que falte» sería negativo y no significaría nada.
  const ultima = families.at(-1)
  const repartidoAntes = families.slice(0, -1).reduce((s, f) => s + (Number(porFamilia[f.id]) || 0), 0)
  const restoUltima = Math.max(0, total - repartidoAntes)

  function ponerValor(id, valor) {
    const limpio = Math.max(0, Number.isFinite(valor) ? valor : 0)
    if (modo === 'partes') return setReparto({ modo, porFamilia: { ...porFamilia, [id]: limpio } })
    const otros = families
      .slice(0, -1)
      .reduce((s, f) => s + (f.id === id ? 0 : Number(porFamilia[f.id]) || 0), 0)
    setReparto(cuadrar({ ...porFamilia, [id]: Math.min(limpio, total - otros) }, families, total))
  }

  return (
    <div className="modal-bg center" onClick={onCerrar}>
      <div
        className="modal center formulario"
        role="dialog"
        aria-modal="true"
        aria-label="Detalles del gasto"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="x" onClick={onCerrar} aria-label="Cerrar">×</button>
        <h2>Detalles</h2>

        <label htmlFor="gasto-desc">Descripción <span className="apunte">(opcional)</span></label>
        <input
          id="gasto-desc" type="text" value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Hielo y birras"
        />

        <label htmlFor="gasto-cuando">Cuándo</label>
        <input
          id="gasto-cuando" type="datetime-local" value={aLocal(dateISO)}
          onChange={(e) => setDateISO(deLocal(e.target.value, dateISO))}
        />

        <label>Cómo se reparte</label>
        <div className="chips">
          {[['pesos', 'Coeficiente'], ['partes', 'Partes'], ['importes', 'Importes']].map(([id, et]) => (
            <button key={id} type="button" className={`chip${modo === id ? ' on' : ''}`} onClick={() => cambiarModo(id)}>
              {et}
            </button>
          ))}
        </div>
        {modo === 'pesos' && (
          <div className="note">
            Por el <b>coeficiente</b> de cada persona (1 el mayor, 0,6 el niño) y entre quien esté marcado en
            «Entre». Es lo que multiplica a lo que le toca, no cuánto pesa.
          </div>
        )}
        {modo !== 'pesos' && (
          <div className="reparto-familias">
            {families.map((f) => {
              const esUltima = f.id === ultima?.id && modo === 'importes'
              return (
                <div className="reng-campo" key={f.id}>
                  <label htmlFor={`rep-${f.id}`}>{f.name}</label>
                  {esUltima ? (
                    <output id={`rep-${f.id}`} className="tnum resto">{formatCents(restoUltima, currency)}</output>
                  ) : (
                    <input
                      id={`rep-${f.id}`} type="number" inputMode="decimal" min="0"
                      step={modo === 'importes' ? '0.01' : '1'}
                      value={modo === 'importes'
                        ? centsToEuros(Number(porFamilia[f.id]) || 0)
                        : (porFamilia[f.id] ?? 0)}
                      onChange={(e) => ponerValor(
                        f.id,
                        modo === 'importes' ? Math.round(Number(e.target.value) * 100) : Number(e.target.value),
                      )}
                    />
                  )}
                </div>
              )
            })}
            <div className="note">
              {modo === 'partes'
                ? <>Dos partes contra una: «la mitad los Pérez» son <b>1</b> y <b>1</b>. Los céntimos sueltos se reparten por resto mayor, como siempre.</>
                : <>El último renglón lleva <b>lo que falte</b> de los {formatCents(total, currency)}: así no se puede guardar un gasto descuadrado.</>}
            </div>
          </div>
        )}

        <div className="grid2">
          <div>
            <label htmlFor="gasto-moneda">Moneda</label>
            <select id="gasto-moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="EUR">€ EUR</option><option value="GBP">£ GBP</option><option value="USD">$ USD</option>
            </select>
          </div>
          {currency !== event.currency && (
            <div>
              <label htmlFor="gasto-cambio">Cambio a {event.currency}</label>
              <input id="gasto-cambio" type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn block" onClick={() => { tap(); onCerrar() }}>Hecho</button>
        </div>
      </div>
    </div>
  )
}
