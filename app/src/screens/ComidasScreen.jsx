import SubNav from '../components/SubNav.jsx'
import CenasScreen from './CenasScreen.jsx'
import PlatosScreen from './PlatosScreen.jsx'
import CompraScreen from './CompraScreen.jsx'
import { useArea } from '../lib/areas.js'

/**
 * «Comidas», con tres áreas (opciones A1, C1 y D1 de
 * `docs/diseño/navegacion.html`).
 *
 * La sección se llama Comidas y el área, Cenas: el modelo solo tiene cenas —una
 * por día, con bunga de mayores y de niños— y así se llaman dentro, pero el
 * rótulo de la barra deja la puerta abierta a que un día haya comidas de
 * mediodía sin volver a tocar la navegación.
 *
 * **La compra se queda aquí**, como tercera área. Al pasar la segunda a ser
 * Platos se habría quedado sin sitio en la navegación entera —el código seguiría
 * ahí y no habría forma de llegar—, y la compra es lo que uno abre en el súper,
 * de pie y con el carro: un toque de más se nota. Con tres áreas el mando da
 * 115,3 pt por hueco, dos veces y media el mínimo de Apple.
 */
const AREAS = [
  { id: 'cenas', label: 'Cenas' },
  { id: 'platos', label: 'Platos' },
  { id: 'compra', label: 'Compra' },
]

export default function ComidasScreen({ eventId, event }) {
  const [area, setArea] = useArea('comidas', 'cenas')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      {area === 'cenas' && <CenasScreen eventId={eventId} event={event} />}
      {area === 'platos' && <PlatosScreen event={event} />}
      {area === 'compra' && <CompraScreen eventId={eventId} event={event} />}
    </>
  )
}
