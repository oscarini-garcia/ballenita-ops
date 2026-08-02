// Tablas que se sincronizan (todo lo que es "hecho" del grupo).
//
// Dos son catálogos compartidos entre eventos —`dishes` y `planIdeas`— y el
// resto cuelga de un evento. Los dos catálogos admiten además un `eventId`
// opcional, que es como el evento «Demo» tiene los suyos sin ensuciar los de
// verdad (§14.9-quater).
export const SYNC_TABLES = [
  'events', 'families', 'bungas', 'persons',
  'expenses', 'settlements', 'dishes', 'dinners', 'planIdeas', 'plans', 'shop',
]
