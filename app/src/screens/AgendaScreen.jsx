import SubNav from '../components/SubNav.jsx'
import HoyScreen from './HoyScreen.jsx'
import DiasScreen from './DiasScreen.jsx'
import StatsScreen from './StatsScreen.jsx'
import { useArea } from '../lib/areas.js'

/**
 * «Agenda», partida en tres áreas (opciones A1 y B2 de
 * `docs/diseño/navegacion.html`; la tercera llegó después, desde Ajustes).
 *
 * La pestaña se llama Agenda y no «Hoy» porque el rótulo nombra la sección, no
 * su primera área: una pestaña «Hoy» que contiene un área «Hoy» deja de decir
 * dónde estás para decir dónde estabas al entrar.
 *
 * Y la segunda se llama «Días» y no «Evento» porque el nombre del evento ya está
 * en la cabecera dos centímetros más arriba, y en Ajustes hay **otro** apartado
 * llamado «Evento» que es donde se cambian sus fechas.
 *
 * La tercera son las estadísticas, que vivían en un acordeón de Ajustes: se
 * **miran**, no se ajustan, y lo que se mira del viaje vive en Agenda. Su
 * rótulo dice «Números» porque «Estadísticas» mide 121,2 pt y la casilla del
 * mando de tres da 103,3 — no cabe ni en Grande—; la pantalla de dentro es la
 * misma y sigue llamándose así.
 */
const AREAS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'dias', label: 'Días' },
  { id: 'stats', label: 'Números' },
]

export default function AgendaScreen({ eventId, event, onGoTab, abrir, onAbierta }) {
  const [area, setArea] = useArea('agenda')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'hoy' && <HoyScreen eventId={eventId} event={event} onGoTab={onGoTab} />}
      {area === 'dias' && <DiasScreen eventId={eventId} event={event} abrir={abrir} onAbierta={onAbierta} />}
      {area === 'stats' && <StatsScreen eventId={eventId} event={event} />}
    </>
  )
}
