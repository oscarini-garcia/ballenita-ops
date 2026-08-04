/**
 * Con qué se cocina, tal como lo cuenta la pantalla (SPECS §14.20-quater).
 *
 * **La autoridad es el servidor**: quien compone el material que lee el modelo
 * es el Worker, y el texto de origen vive en `api/src/cocina.js`. Aquí hay una
 * copia por una sola razón: el campo del evento nace vacío, y vacío significa
 * «vale el de siempre» —como los encargos, §14.16-quater—. Sin enseñarlo, esa
 * regla es invisible y el campo parece que no hace nada.
 *
 * Una copia que se separa del original enseñaría una cosa y mandaría otra, así
 * que `cocina.test.js` lee el fichero del Worker y las compara. Si alguien
 * cambia una, el test dice cuál.
 */
export const COCINA_DE_ORIGEN = [
  'Barbacoa y plancha eléctrica profesional, que es donde se hace casi todo.',
  'Hay una granizadora Ninja.',
  'En el bungaló se puede hacer algo sencillo en sartén, pero poco: da mucho calor.',
].join(' ')
