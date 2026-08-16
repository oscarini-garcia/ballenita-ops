// Grupo: quién viene, dónde duerme cada familia y qué gadget ha traído.
//
// Es la quinta pestaña desde §14.52 (`docs/diseño/donde-vive-el-grupo.html` · Q2)
// y desde §14.63 va **partida en tres áreas**. Cabía todo en una lista mientras
// era el censo; con las notas del bunga, su histórico y el gadget de cada casa,
// una sola columna obligaba a rodar media pantalla para llegar a lo que se
// venía a mirar.
//
// Las tres palabras caben: la casilla de un mando de tres da 103,3 pt y la más
// larga es «Gadgets» con 83,8 (`docs/diseño/siete-encargos.html` · parte cero).
import SubNav from '../components/SubNav.jsx'
import GrupoSection from './GrupoSection.jsx'
import CacharrosSection from './CacharrosSection.jsx'
import { useArea } from '../lib/areas.js'

const AREAS = [
  { id: 'familias', label: 'Familias' },
  { id: 'bungas', label: 'Bungas' },
  { id: 'gadgets', label: 'Gadgets' },
]

export default function GrupoScreen({ eventId, event }) {
  const [area, setArea] = useArea('grupo', 'familias')
  return (
    <>
      <SubNav value={area} onChange={setArea} options={AREAS} />
      <div className="body">
        {/* Familias y Bungas comparten componente y no por pereza: los tres
            editores —familia, bunga y persona— y las dos hojas de emparejar son
            los mismos, y partirlos en dos ficheros duplicaría el estado que
            decide cuál está abierto. */}
        {area !== 'gadgets' && <GrupoSection eventId={eventId} area={area} />}
        {area === 'gadgets' && <CacharrosSection eventId={eventId} event={event} />}
      </div>
    </>
  )
}
