-- El alias de dos letras de una familia, y las dos fechas de una idea.
--
-- **`families.alias`** — «GA», «PE», «SO». Los bungas ya tenían alias
-- (`bungas.alias`, «El de la piscina»); las familias no. Hace falta para la
-- lista de ideas, donde la firma de una fila es «Curro · GA · hace 3 días» y el
-- nombre entero de la familia no cabe en una línea de 15,7 pt junto al nombre de
-- la persona y la fecha. Decidido en `docs/diseño/planes-ideas.html` · D3, donde
-- además se propone solo desde el nombre: el único fallo que rompe esa fila es
-- que el alias esté vacío.
--
-- **`planIdeas.apuntadaEl`** y **`plans.propuestoEl`** — el «cuándo» de una
-- idea, que hasta ahora no existía en el móvil. `creadoEn` lo pone el Worker al
-- insertar y solo vuelve en la instantánea, así que una idea recién apuntada no
-- tenía fecha hasta sincronizar, y en la web —que no sincroniza a propósito— no
-- la tenía nunca. Estas dos las escribe **el cliente** al crear, así que están
-- desde el primer pintado y funcionan sin API.
--
-- Son dos fechas y no una porque son dos hechos distintos: cuándo se apuntó la
-- idea al catálogo (puede ser de hace tres agostos) y cuándo se propuso a *este*
-- viaje. La lista enseña la que corresponde a cada grupo
-- (`docs/diseño/planes-ideas.html` · F2).
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto8

ALTER TABLE families  ADD COLUMN alias       TEXT;
ALTER TABLE planIdeas ADD COLUMN apuntadaEl  TEXT;
ALTER TABLE plans     ADD COLUMN propuestoEl TEXT;
