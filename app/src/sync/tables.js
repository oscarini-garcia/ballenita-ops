// Tablas que se sincronizan (todo lo que es "hecho" del grupo).
//
// Dos son catálogos compartidos entre eventos —`dishes` y `planIdeas`— y el
// resto cuelga de un evento, salvo `mejoras`, que es de la app entera. Los
// catálogos y las mejoras admiten además un `eventId` opcional, que es como el
// evento «Demo» tiene los suyos sin ensuciar los de verdad (§14.9-quater).
export const SYNC_TABLES = [
  'events', 'families', 'bungas', 'persons',
  'expenses', 'settlements', 'dishes', 'dinners', 'planIdeas', 'plans', 'shop',
  'mejoras', 'registro',
  // La tanda de §14.52–§14.58. `trucos` y `alojamientos` son catálogos, como
  // `dishes` y `planIdeas`: valen para todos los viajes. `comentarios` y
  // `cacharros` cuelgan de su evento.
  'trucos', 'comentarios', 'alojamientos', 'cacharros',
]
