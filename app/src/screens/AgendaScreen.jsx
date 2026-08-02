import SubNav from '../components/SubNav.jsx'
import HoyScreen from './HoyScreen.jsx'
import DiasScreen from './DiasScreen.jsx'
import { useArea } from '../lib/areas.js'

/**
 * «Agenda», partida en dos áreas (opciones A1 y B2 de
 * `docs/diseño/navegacion.html`).
 *
 * La pestaña se llama Agenda y no «Hoy» porque el rótulo nombra la sección, no
 * su primera área: una pestaña «Hoy» que contiene un área «Hoy» deja de decir
 * dónde estás para decir dónde estabas al entrar.
 *
 * Y la segunda se llama «Días» y no «Evento» porque el nombre del evento ya está
 * en la cabecera dos centímetros más arriba, y en Ajustes hay **otro** apartado
 * llamado «Evento» que es donde se cambian sus fechas.
 */
const AREAS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'dias', label: 'Días' },
]

export default function AgendaScreen({ eventId, event, onGoTab }) {
  const [area, setArea] = useArea('agenda', 'hoy')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'hoy'
        ? <HoyScreen eventId={eventId} event={event} onGoTab={onGoTab} />
        : <DiasScreen eventId={eventId} event={event} />}
    </>
  )
}
