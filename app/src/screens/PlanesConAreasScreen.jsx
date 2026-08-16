import SubNav from '../components/SubNav.jsx'
import PlanesScreen from './PlanesScreen.jsx'
import IdeasScreen from './IdeasScreen.jsx'
import TrucosScreen from './TrucosScreen.jsx'
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
/**
 * Y desde §14.53, una tercera: **Trucos**.
 *
 * Aquí y no en un acordeón de Ajustes porque Planes ya es el sitio de lo que se
 * repite de un viaje a otro —Ideas es literalmente eso— y porque a Ajustes no
 * entra nadie durante el viaje, que es justo cuando un truco sirve. Cabe: la
 * palabra mide 65,4 pt y con tres casillas cada una da 103,3 (con cuatro
 * bajarían a 73,5, y por eso los cacharros se quedaron en Grupo).
 */
const AREAS = [
  { id: 'planes', label: 'Planes' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'trucos', label: 'Trucos' },
]

export default function PlanesConAreasScreen({ eventId, event, abrir, onAbierta }) {
  const [area, setArea] = useArea('planes', 'planes')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'planes' && <PlanesScreen eventId={eventId} event={event} abrir={abrir} onAbierta={onAbierta} />}
      {area === 'ideas' && <IdeasScreen eventId={eventId} event={event} />}
      {area === 'trucos' && <TrucosScreen eventId={eventId} event={event} />}
    </>
  )
}
