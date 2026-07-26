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

// `seccion`/`onSeccion` son opcionales: App las controla para que el ⚙️ de la
// cabecera abra Ajustes directamente. Sin ellas la pantalla se apaña sola.
export default function MasScreen({ eventId, event, onChangeEvent, seccion, onSeccion, sync }) {
  // Si venimos de una actualización, abrimos directamente en Ajustes (donde está
  // el botón y el ✓), no en Estadísticas.
  const [interno, setInterno] = useState(() => (veniaDeActualizar() ? 'ajustes' : 'stats'))
  const seg = seccion ?? interno
  const cambiar = onSeccion ?? setInterno
  return (
    <>
      <SubNav value={seg} onChange={cambiar} options={OPTIONS} />
      {seg === 'stats'
        ? <StatsScreen eventId={eventId} event={event} />
        : <EventSettingsScreen eventId={eventId} event={event} onChangeEvent={onChangeEvent} sync={sync} />}
    </>
  )
}
