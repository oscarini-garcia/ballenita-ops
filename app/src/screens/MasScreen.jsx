import { useState } from 'react'
import SubNav from '../components/SubNav.jsx'
import StatsScreen from './StatsScreen.jsx'
import EventSettingsScreen from './EventSettingsScreen.jsx'
import { veniaDeActualizar } from '../lib/pwa.js'

// «Más» recoge lo secundario (Opción A de UX): las estadísticas de vanidad y los
// ajustes del evento. Así la barra inferior se queda en 5 destinos limpios y el
// núcleo (Hoy · Dinero · Cenas · Planes) manda.
const OPTIONS = [
  { id: 'stats', label: '📊 Estadísticas' },
  { id: 'ajustes', label: '⚙️ Ajustes' },
]

export default function MasScreen({ eventId, event, onChangeEvent }) {
  // Si venimos de una actualización, abrimos directamente en Ajustes (donde está
  // el botón y el ✓), no en Estadísticas.
  const [seg, setSeg] = useState(() => (veniaDeActualizar() ? 'ajustes' : 'stats'))
  return (
    <>
      <SubNav value={seg} onChange={setSeg} options={OPTIONS} />
      {seg === 'stats'
        ? <StatsScreen eventId={eventId} event={event} />
        : <EventSettingsScreen eventId={eventId} event={event} onChangeEvent={onChangeEvent} />}
    </>
  )
}
