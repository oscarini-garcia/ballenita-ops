import SubNav from '../components/SubNav.jsx'
import PlatosScreen from './PlatosScreen.jsx'
import CompraScreen from './CompraScreen.jsx'
import { useArea } from '../lib/areas.js'

/**
 * «Comidas», con dos áreas: **la Carta y la Compra**
 * (`docs/diseño/cenas-fuera-y-reparto.html` · N1).
 *
 * **«Cenas» se retiró**, y no por sitio sino porque una cena cuelga de un día:
 * se monta en Agenda → el día, que es donde además están sus bungas y su plan.
 * Tener las dos puertas repartía el mismo trabajo en dos sitios que no se
 * parecían —una lista de tarjetas con un modal de fecha libre, y la capa del
 * día— y dejaba crear una cena en una fecha que el viaje no tiene, que es de
 * donde salían las cenas huérfanas de §14.10-quater.
 *
 * Lo que queda aquí es lo que **no cuelga de un día**: el catálogo de lo que se
 * sabe cocinar y la lista de la compra. Y la sección sigue llamándose Comidas
 * —no «Cocina» (N3)— porque el rótulo de la barra es lo único de esto que hay
 * que aprenderse, y lleva puesto desde §14.10-ter.
 *
 * **La compra se queda aquí** y no en Agenda: es lo que uno abre en el súper, de
 * pie y con el carro, y un toque de más se nota. Con dos áreas el mando da
 * 173 pt por hueco, casi cuatro veces el mínimo de Apple.
 */
const AREAS = [
  // **«Carta» y no «Platos»**: el área es el catálogo de lo que se sabe cocinar
  // —lo que se elige para una cena—, y «Platos» se confundía con los platos *de
  // esta cena*, que es lo que se marca en el día. El `id` se queda en `platos`:
  // es lo que hay guardado en cada móvil (`lib/areas.js` recuerda el área
  // abierta), y renombrarlo devolvería a todo el mundo al principio por nada.
  { id: 'platos', label: 'Carta' },
  { id: 'compra', label: 'Compra' },
]

export default function ComidasScreen({ eventId, event }) {
  const [area, setArea] = useArea('comidas')
  // Quien tuviera «Cenas» abierta cuando entró la versión —`lib/areas.js` es
  // memoria del módulo y sobrevive a un cambio de pestaña— se quedaba con el
  // mando sin nada marcado y el cuerpo en blanco. Un área que ya no existe cae
  // en la primera.
  const actual = AREAS.some((a) => a.id === area) ? area : AREAS[0].id
  return (
    <>
      <SubNav value={actual} onChange={setArea} options={AREAS} />
      {actual === 'platos' && <PlatosScreen event={event} />}
      {actual === 'compra' && <CompraScreen eventId={eventId} event={event} />}
    </>
  )
}
