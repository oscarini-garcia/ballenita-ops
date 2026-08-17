-- Noches que se cena fuera, y dónde (SPECS §14.70).
--
-- **`dinners.fuera`** — 1 si esa noche se cena fuera del camping, 0 o NULL si se
-- cocina. **`dinners.donde`** — el sitio, texto libre: «el chiringuito de Paco»,
-- «Casa Marisa». Vacío es legítimo: se sabe que se sale y todavía no dónde.
--
-- Van dos columnas y no una porque la alternativa era guardar el sitio en un
-- solo campo y leer «hay sitio» como «se cena fuera». Eso deja `''` —salir sin
-- saber dónde— valiendo lo mismo que NULL en cualquier `if` de JavaScript, y ese
-- es el tipo de trampa que se paga meses después y en la pantalla de otro.
--
-- Antes esto se apuntaba como **plan** —«Tardeo cena de chiringo»— porque era el
-- único sitio donde cabía escribirlo, y el día se quedaba diciendo «sin cena»
-- teniendo la cena decidida. De ahí salían dos cosas mal: el semáforo del día no
-- se ponía verde nunca, y la noche no contaba como cena en ningún sitio.
--
-- Lo que **sí** cambia solo: una cena fuera no lleva platos, así que no manda
-- nada a la lista de la compra (`platosDeLaCena`, `lib/compra.js`).
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto21

ALTER TABLE dinners ADD COLUMN fuera INTEGER;
ALTER TABLE dinners ADD COLUMN donde TEXT;
