// Saldos: cuánto debe cada familia y quién paga a quién.
//
// No guarda nada: los saldos se **calculan** en local a partir de los hechos
// (`lib/reparto.js`), que es la regla de oro del proyecto. Un saldo no se
// sincroniza jamás.
import { useLiveQuery } from 'dexie-react-hooks'
import { expensesOf, familiesOf, personsOf, settlementsOf, addSettlement } from '../db.js'
import { computeFamilyBalances, simplifyDebts } from '../lib/reparto.js'
import { formatCents } from '../lib/money.js'
import Alias from '../components/Alias.jsx'

/**
 * Saldos, decidido en `docs/diseño/saldos.html` · **F3 · R2 · E1**.
 *
 * **La familia se enseña como en el resto de la app** (F3): el nombre con su
 * pastilla de dos letras (`Alias.jsx`), la misma que firma una idea, marca a
 * quien vota un plan y nombra el bunga en su selector. Antes era el emoji de la
 * familia sobre su color pleno, y las iniciales ahí no se podían poner: sobre
 * el azul de los Solteros dan **2,81 : 1** con letra blanca y sobre el rojo de
 * los García **4,24 : 1** con letra oscura, así que habría que elegir la letra
 * por familia. La pastilla mezcla —fondo al 20 %, letra al 55 % con la tinta—
 * y da **4,82 a 5,85 : 1** en las dos caras con cualquier color que alguien
 * elija. El emoji no se pierde: sigue en Ajustes → El grupo, que es donde se
 * elige.
 *
 * **El renglón de saldar dice quién paga a quién en dos líneas** (R2): arriba
 * «García → Solteros» y debajo el importe, con «pagado» al lado en vez de
 * apilado bajo la cifra. La sección se llama **«Quién paga a quién»**, así que
 * la flecha no hay que interpretarla — y con eso se va «transferencia
 * pendiente», que decía por tercera vez lo que ya decían el encabezado y el
 * botón. Medido: la fila pasa de **93,5 a 70,7 pt** (un 24 % menos) **sin
 * tocar la letra** (E1), que en esta app está grande a propósito (§14.11); y
 * de paso el titular deja de recortarse — con el botón apilado le quedaban
 * 233 pt y «García → Solteros» no cabía.
 */
export default function BalancesScreen({ eventId, event }) {
  const expenses = useLiveQuery(() => expensesOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const settlements = useLiveQuery(() => settlementsOf(eventId), [eventId], [])

  const personsById = Object.fromEntries(persons.map((p) => [p.id, p]))
  const famById = Object.fromEntries(families.map((f) => [f.id, f]))

  /**
   * Quién es el dueño de un saldo. Una persona sin familia es una **familia de
   * uno** (`solo:<persona>`, §3.3), y la pantalla las llamaba a todas «Sin
   * familia»: con dos, no había manera de saber cuál debía qué. Ahora dice su
   * nombre, y su pastilla va en gris porque no hay color de familia que poner.
   */
  const comoFamilia = (id) => {
    if (famById[id]) return famById[id]
    if (id.startsWith('solo:')) {
      const p = personsById[id.slice(5)]
      return { id, name: p?.apodo || p?.name || 'Sin familia', color: 'var(--ink-faint)' }
    }
    return null
  }
  const nombre = (id) => comoFamilia(id)?.name ?? '—'

  const balances = computeFamilyBalances(expenses, settlements, personsById)
  const transfers = simplifyDebts(balances)
  const rows = [...balances.entries()].filter(([, c]) => c !== 0).sort((a, b) => b[1] - a[1])

  const anySettled = settlements.length > 0

  return (
    <div className="body">
      {expenses.length === 0 ? (
        <div className="empty">
          <span className="e">📊</span>Sin gastos, sin cuentas.<br />
          Añade gastos y aquí verás quién debe a quién.<br />
          De momento nadie debe nada a nadie, que es el mejor saldo posible.
        </div>
      ) : (
        <>
          <div className="sec-h">Saldo por familia</div>
          <div className="card tight">
            {rows.length === 0 && <div className="empty" style={{ padding: 14 }}>Todo cuadrado 🎉</div>}
            {rows.map(([fid, cents]) => (
              <div className="row" key={fid}>
                <div className="main">
                  <div className="n">{nombre(fid)}<Alias familia={comoFamilia(fid)} /></div>
                  <div className="sub">{cents > 0 ? 'le deben' : 'debe'}</div>
                </div>
                <div className={`amt tnum ${cents > 0 ? 'owed' : 'owe'}`}>{cents > 0 ? '+' : ''}{formatCents(cents, event.currency)}</div>
              </div>
            ))}
          </div>

          {/* El encabezado dice de una vez lo que la flecha dibuja, y por eso la
              flecha no necesita glosa en cada fila. */}
          <div className="sec-h">Quién paga a quién</div>
          {transfers.length === 0 ? (
            <div className="note">🐳 No hay nada pendiente. La ballenita está satisfecha.</div>
          ) : (
            <div className="card tight">
              {transfers.map((t, i) => (
                <div className="row" key={i}>
                  <div className="main">
                    <div className="n">{nombre(t.fromFamilyId)} <span className="flecha">→</span> {nombre(t.toFamilyId)}</div>
                    <div className="sub tnum">{formatCents(t.amountCents, event.currency)}</div>
                  </div>
                  <button className="btn sm ghost" onClick={() => addSettlement(eventId, t)}>pagado</button>
                </div>
              ))}
            </div>
          )}

          <div className="note">La app <b>lleva la cuenta</b>, no mueve dinero: haces el Bizum fuera y aquí marcas «pagado» (§3.4).</div>

          {anySettled && (
            <>
              <div className="sec-h">Pagos apuntados</div>
              <div className="card tight">
                {/* La misma figura en pasado: dos listas hermanas que se
                    escribieran distinto se leerían como dos cosas. El ✓ verde
                    se queda porque ahí el dibujo dice el estado, no la familia. */}
                {settlements.map((s) => (
                  <div className="row" key={s.id}>
                    <div className="main">
                      <div className="n">{nombre(s.fromFamilyId)} <span className="flecha">→</span> {nombre(s.toFamilyId)}</div>
                      <div className="sub tnum">
                        {new Date(s.dateISO).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        {' · '}{formatCents(s.amountCents, event.currency)}
                      </div>
                    </div>
                    <div className="amt owed" aria-label="Pagado">✓</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
