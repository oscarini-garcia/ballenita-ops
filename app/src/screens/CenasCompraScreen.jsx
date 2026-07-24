import { useState } from 'react'
import SubNav from '../components/SubNav.jsx'
import CenasScreen from './CenasScreen.jsx'
import CompraScreen from './CompraScreen.jsx'

// La lista de la compra es logística de comida (§6.6), así que en la Opción A de
// UX vive dentro de «Cenas» como segunda sub-pestaña, en vez de suelta en la barra.
const OPTIONS = [
  { id: 'cenas', label: '🍳 Cenas' },
  { id: 'compra', label: '🛒 Compra' },
]

export default function CenasCompraScreen({ eventId, event }) {
  const [seg, setSeg] = useState('cenas')
  return (
    <>
      <SubNav value={seg} onChange={setSeg} options={OPTIONS} />
      {seg === 'cenas'
        ? <CenasScreen eventId={eventId} event={event} />
        : <CompraScreen eventId={eventId} event={event} />}
    </>
  )
}
