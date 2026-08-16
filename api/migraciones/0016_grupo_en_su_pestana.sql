-- La tanda del grupo: seis cosas nuevas en una sola migración (SPECS §14.52–§14.58).
--
-- Van juntas porque salen de la misma vuelta y porque **una migración se aplica
-- a mano** (§14.23): partirlas en seis obligaría a pulsar seis veces desde el
-- móvil, y a que quedar a medias fuera un estado posible. Aplicar esto entero es
-- todo o nada, que es lo que queremos.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto16

-- ── 1. La compra por familia (§14.54) ────────────────────────────────────────
--
-- NULL = línea común, que es como nacen todas las de siempre y todas las que
-- calculan las cenas. Por eso no lleva `DEFAULT` ni `NOT NULL`: los ítems ya
-- apuntados siguen valiendo lo que valían, sin tocarlos.
ALTER TABLE shop ADD COLUMN familyId TEXT;

-- ── 2. Quién lleva las cuentas (§14.58) ──────────────────────────────────────
--
-- No es un rasgo de la persona sino un **encargo**: lo pone quien administra y
-- no se deduce de la edad. Nace apagado para todo el mundo, que es lo correcto —
-- encenderlo a todos convertiría el primer gasto del viaje en nueve avisos.
ALTER TABLE persons ADD COLUMN llevaLasCuentas INTEGER NOT NULL DEFAULT 0;

-- ── 3. El bunga apunta a su sitio (§14.56) ───────────────────────────────────
--
-- Hasta hoy `bungas` colgaba de un evento y nada más, así que el «Bunga 12» de
-- 2025 y el de 2026 eran **dos filas sin nada que las una**: una nota escrita
-- este agosto se iba con el evento, y el histórico de qué familia durmió dónde
-- no existía. NULL = un bunga suelto de este viaje, que es lo que eran todos.
ALTER TABLE bungas ADD COLUMN alojamientoId TEXT;

-- ── 4. El catálogo de alojamientos (§14.56) ──────────────────────────────────
--
-- La misma figura que `dishes` ↔ `dinners` y `planIdeas` ↔ `plans`, por cuarta
-- vez: aquí vive lo que **no cambia de un año a otro** —cómo es el sitio, sus
-- notas, sus pegatinas— y en `bungas` lo que es de este agosto: qué familia lo
-- tiene. `eventId` nulo = de todos; con valor, solo del Demo (§14.9-quater).
--
-- `pegatinas` es JSON —una lista de ids— y no siete columnas: son etiquetas que
-- se tocan, y añadir la octava no puede costar una migración.
CREATE TABLE IF NOT EXISTS alojamientos (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  notas     TEXT,
  pegatinas TEXT,
  eventId   TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- ── 5. Los trucos (§14.53) ───────────────────────────────────────────────────
--
-- Lo que hay que acordarse de un viaje a otro. Catálogo compartido, como los
-- otros dos. **No lleva `hecho`** y no es un descuido: se pensó una lista de
-- embarque que se tildara cada viaje y se descartó — un truco no es una tarea,
-- es algo que sigue siendo verdad el año que viene, y tildarlo obligaría a una
-- segunda tabla de estado por evento para nada.
CREATE TABLE IF NOT EXISTS trucos (
  id         TEXT PRIMARY KEY,
  texto      TEXT,
  categoria  TEXT,
  autorId    TEXT,
  apuntadoEl TEXT,
  eventId    TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);

-- ── 6. Los comentarios (§14.55) ──────────────────────────────────────────────
--
-- **Una tabla con ancla, y no una columna por tabla.** `ancla` es
-- `'<tipo>:<id>'` —`plan:abc`, `gasto:def`, `dia:2026-08-15`— y con ella el
-- mismo componente sirve en las ocho pantallas donde un comentario pide salir.
-- La alternativa era un JSON dentro de cada fila, y tenía dos defectos que no se
-- arreglan después: una migración por sitio, y **dos personas comentando a la
-- vez se pisan**, porque cada una sube la fila entera del plan.
CREATE TABLE IF NOT EXISTS comentarios (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  ancla     TEXT,
  texto     TEXT,
  autorId   TEXT,
  escritoEl TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- Un hilo se lee siempre por su ancla, y el globo de una fila cuenta por evento.
CREATE INDEX IF NOT EXISTS idx_comentarios_ancla ON comentarios (ancla, escritoEl);
CREATE INDEX IF NOT EXISTS idx_comentarios_evento ON comentarios (eventId);

-- ── 7. Los cacharros (§14.57) ────────────────────────────────────────────────
--
-- El que trae cada familia, y quién vota cuál. `votos` es el mismo mapa
-- persona → valor que en `plans`, así que no hay maquinaria nueva: `votosDe` ya
-- cuenta y `Alias` ya firma. Uno por familia y un voto por cabeza son reglas del
-- cliente, no del esquema — con dos filas de la misma familia la pantalla se
-- queda con la última y lo dice, que es mejor que una restricción que rompa una
-- sincronización a medias.
CREATE TABLE IF NOT EXISTS cacharros (
  id         TEXT PRIMARY KEY,
  eventId    TEXT,
  familyId   TEXT,
  texto      TEXT,
  votos      TEXT,
  apuntadoEl TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cacharros_evento ON cacharros (eventId);
