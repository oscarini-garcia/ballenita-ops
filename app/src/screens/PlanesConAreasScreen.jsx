import SubNav from '../components/SubNav.jsx'
import PlanesScreen from './PlanesScreen.jsx'
import IdeasScreen from './IdeasScreen.jsx'
import { useArea } from '../lib/areas.js'

/**
 * «Planes», partido en dos áreas: lo de este viaje y el catálogo.
 *
 * Era la única sección sin mando de áreas. Ponerlo cuesta 66 pt de cuerpo
 * —Planes tenía 699,6 y se queda en los 633,6 que ya tienen Agenda y Comidas—,
 * y los paga porque un catálogo invisible no es un catálogo: la mitad de para
 * qué existe es poder abrir «¿qué hacíamos los otros años?».
 *
 * Es la misma figura que Comidas · Platos. Decidido en
 * `docs/diseño/planes-catalogo.html` · B3 (el área **y** el atajo del modal,
 * porque responden a dos preguntas distintas).
 */
const AREAS = [
  { id: 'planes', label: 'Planes' },
  { id: 'ideas', label: 'Ideas' },
]

export default function PlanesConAreasScreen({ eventId, event }) {
  const [area, setArea] = useArea('planes', 'planes')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'planes' && <PlanesScreen eventId={eventId} event={event} />}
      {area === 'ideas' && <IdeasScreen eventId={eventId} event={event} />}
    </>
  )
}
