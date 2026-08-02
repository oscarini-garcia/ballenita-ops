-- El evento de demostración deja de contaminar el catálogo compartido.
--
-- `dishes` era la única tabla que no colgaba de un evento: un catálogo global,
-- y a propósito —la paella no se reescribe cada verano—. El problema es que el
-- evento «Demo» escribía en ese mismo catálogo, así que sus seis platos de
-- mentira aparecían al preparar un viaje de verdad, y cualquier plato apuntado
-- mientras se trasteaba se quedaba allí para siempre.
--
-- Ahora un plato puede llevar `eventId`. Sin él es del catálogo de todos (el
-- comportamiento de siempre, y por eso la columna es NULL por defecto); con él
-- pertenece solo a ese evento, que hoy es únicamente el Demo. `events.esDemo`
-- es lo que distingue a ese evento de un viaje.
--
-- Estas dos columnas están ya en `0001_esquema.sql` para una base nueva. Este
-- fichero es para la que ya existe:
--
--   npm run migrar:remoto2

ALTER TABLE events ADD COLUMN esDemo INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dishes ADD COLUMN eventId TEXT;
