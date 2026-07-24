import { useState } from 'react'
import SubNav from '../components/SubNav.jsx'
import ExpensesScreen from './ExpensesScreen.jsx'
import BalancesScreen from './BalancesScreen.jsx'

// «Dinero» une las dos caras de lo económico (Opción A de UX): metes el gasto y
// ves quién debe a quién sin cambiar de pestaña. El FAB de «+ gasto» vive dentro
// de ExpensesScreen, así que solo aparece en la sub-pestaña Gastos (FAB contextual).
const OPTIONS = [
  { id: 'gastos', label: '💸 Gastos' },
  { id: 'saldos', label: '⚖️ Saldos' },
]

export default function DineroScreen({ eventId, event }) {
  const [seg, setSeg] = useState('gastos')
  return (
    <>
      <SubNav value={seg} onChange={setSeg} options={OPTIONS} />
      {seg === 'gastos'
        ? <ExpensesScreen eventId={eventId} event={event} />
        : <BalancesScreen eventId={eventId} event={event} />}
    </>
  )
}
