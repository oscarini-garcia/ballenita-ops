// Grupo: quién viene, dónde duerme cada familia y qué cacharro ha traído.
//
// Es la quinta pestaña desde §14.52 (`docs/diseño/donde-vive-el-grupo.html` · Q2).
// Antes era un acordeón dentro de Ajustes, y dejó de caber ahí el día que el
// bunga tuvo notas e histórico y cada familia su cacharro: eso no se ajusta, se
// mira — el mismo motivo por el que las estadísticas salieron de Ajustes en
// §14.10-ter.
import GrupoSection from './GrupoSection.jsx'
import CacharrosSection from './CacharrosSection.jsx'

export default function GrupoScreen({ eventId, event }) {
  return (
    <div className="body">
      <GrupoSection eventId={eventId} />
      <CacharrosSection eventId={eventId} event={event} />
    </div>
  )
}
