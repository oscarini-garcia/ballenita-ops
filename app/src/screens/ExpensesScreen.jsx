import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { expensesOf, familiesOf, personsOf, removeExpense } from '../db.js'
import { formatCents } from '../lib/money.js'
import { catOf } from '../lib/categorias.js'
import Deslizable from '../components/Deslizable.jsx'
import Fab from '../components/Fab.jsx'
import Recado from '../components/Recado.jsx'
import Icono from '../components/Icono.jsx'
import Confirmar from '../components/Confirmar.jsx'
import { comoSeReparte } from '../lib/reparto-gente.js'
import { queSeLlevaUnGasto } from '../lib/borrados.js'
import { tap } from '../lib/native.js'
import FichaDeGasto from './FichaDeGasto.jsx'

/** «19:40» — desempata dos gastos de la misma categoría el mismo día. */
function hora(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ExpensesScreen({ eventId, event }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  // null = cerrado · 'nuevo' = alta · un gasto = edición de ese gasto.
  const [ficha, setFicha] = useState(null)
  // El gasto que se está a punto de borrar, o null.
  const [borrando, setBorrando] = useState(null)
  const famName = (id) => families.find((f) => f.id === id)?.name ?? '—'

  const total = expenses.reduce((s, e) => s + (e.amountCents ?? 0), 0)

  return (
    <div className="body">
      <div className="card tight" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="cifra-l">Gasto total del evento</div>
          <div className="tnum cifra">{formatCents(total, event.currency)}</div></div>
        <div className="pill neutral">{expenses.length} gastos</div>
      </div>

      {expenses.length === 0 && (
        <div className="empty">
          <span className="e">💸</span>Ni un gasto todavía.<br />
          Apunta el primero con «+ Gasto».<br />
          O no habéis salido de la bunga, o alguien está pagando en secreto.
        </div>
      )}

      {/* Una tarjeta por gasto. **Se toca para corregirlo** —la misma pantalla
          con la que se apuntó, que es lo que se viene a hacer la mitad de las
          veces que se abre un gasto— y se desliza a la izquierda para borrarlo.
          «Editar» estuvo detrás del gesto y se retiró al poner el toque: dos
          caminos a la misma pantalla, uno de ellos escondido, y el escondido
          además el único que se anunciaba (§14.19, el «+ Plan»). */}
      <div className="lista-deslizable">
        {expenses.map((e) => {
          const c = catOf(e.category)
          // B3 · la descripción si la hay, y si no la categoría. Escribir dejó de
          // ser obligatorio para apuntar un gasto, así que la fila necesitaba un
          // nombre para los días en que nadie escribe nada.
          const puesto = e.description?.trim()
          // B2 · debajo va quién pagó y, cuando el reparto no es el de todos,
          // cuál fue: es lo único que hoy no se ve sin abrir el gasto. La hora
          // solo cuando no hay descripción, que es cuando hace falta desempatar
          // —«Pagó Solteros · sin los niños» ya son 238 pt de los 245 que caben—.
          const raro = comoSeReparte(e, persons)
          const sub = [
            puesto ? c.label : null,
            `${puesto ? 'p' : 'P'}agó ${e.payers?.map((p) => famName(p.familyId)).join(', ')}`,
            raro || (puesto ? null : hora(e.dateISO)),
          ].filter(Boolean).join(' · ')
          return (
            <Deslizable
              key={e.id}
              ancho={76}
              verbos={
                <button className="verbo borrar" onClick={() => { tap(); setBorrando(e) }}>
                  <Icono nombre="papelera" className="g" />Borrar
                </button>
              }
            >
              <button type="button" className="row fila-gasto" onClick={() => setFicha(e)}>
                <span className="ico" data-cat={c.tono}><Icono nombre={c.icon} /></span>
                <span className="main">
                  <span className="n">{puesto || c.label}</span>
                  <span className="sub">
                    {sub}
                    {e.currency && e.currency !== event.currency && <> · <span className="pill fx">{e.amountOriginal} {e.currency}</span></>}
                  </span>
                </span>
                <span className="amt tnum">{formatCents(e.amountCents, event.currency)}</span>
              </button>
            </Deslizable>
          )
        })}

        {/* Un gasto borrado **recalcula el saldo de todas las familias**, y ese
            efecto vive en otra pantalla: quien borra no lo ve nunca. Es la
            cascada más silenciosa que hay, y por eso el verbo del deslizado
            dejó de borrar y pasa a preguntar (borrar-confirmaciones.html · A2). */}
        {borrando && (
          <Confirmar
            queSeLleva={queSeLlevaUnGasto(borrando, {
              familias: families,
              personas: persons,
              importe: formatCents(borrando.amountCents, event.currency),
            })}
            onDejarlo={() => { tap(); setBorrando(null) }}
            onBorrar={async () => { tap(); await removeExpense(borrando.id); setBorrando(null) }}
          />
        )}
      </div>

      {/* El recado del viaje, al final del scroll (SPECS §14.25). */}
      <Recado evento={event} />

      <Fab label="Gasto" onClick={() => setFicha('nuevo')} />

      {ficha && (
        <FichaDeGasto
          event={event} eventId={eventId} families={families} persons={persons}
          gasto={ficha === 'nuevo' ? null : ficha}
          onClose={() => setFicha(null)}
        />
      )}
    </div>
  )
}
