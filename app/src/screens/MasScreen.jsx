import { useState } from 'react'
import SubNav from '../components/SubNav.jsx'
import StatsScreen from './StatsScreen.jsx'
import EventSettingsScreen from './EventSettingsScreen.jsx'

// «Más» recoge lo secundario (Opción A de UX): las estadísticas de vanidad y los
// ajustes del evento. Así la barra inferior se queda en 5 destinos limpios y el
// núcleo (Hoy · Dinero · Cenas · Planes) manda.
const OPTIONS = [
  { id: 'stats', label: '📊 Estadísticas' },
  { id: 'ajustes', label: '⚙️ Ajustes' },
]

export default function MasScreen({ eventId, event, onChangeEvent }) {
  const [seg, setSeg] = useState('stats')
  return (
    <>
      <SubNav value={seg} onChange={setSeg} options={OPTIONS} />
      {seg === 'stats'
        ? <StatsScreen eventId={eventId} event={event} />
        : <EventSettingsScreen eventId={eventId} event={event} onChangeEvent={onChangeEvent} />}
    </>
  )
}
