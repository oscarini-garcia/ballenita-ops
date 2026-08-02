import SubNav from '../components/SubNav.jsx'
import ExpensesScreen from './ExpensesScreen.jsx'
import BalancesScreen from './BalancesScreen.jsx'
import { useArea } from '../lib/areas.js'

// «Dinero» une las dos caras de lo económico: metes el gasto y ves quién debe a
// quién sin cambiar de pestaña. El FAB de «+ Gasto» vive dentro de
// ExpensesScreen, así que solo aparece en el área Gastos.
//
// Es la única sección que el repaso de navegación no ha tocado: ya estaba bien.
const AREAS = [
  { id: 'gastos', label: 'Gastos' },
  { id: 'saldos', label: 'Saldos' },
]

export default function DineroScreen({ eventId, event }) {
  const [area, setArea] = useArea('dinero', 'gastos')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'gastos'
        ? <ExpensesScreen eventId={eventId} event={event} />
        : <BalancesScreen eventId={eventId} event={event} />}
    </>
  )
}
