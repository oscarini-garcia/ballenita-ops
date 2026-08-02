-- El catálogo de ideas de plan.
--
-- Un plan era dos cosas en la misma fila: la **idea** que se repite cada verano
-- —«Playa de la Cala», su ubicación, su enlace— y la **propuesta de este año**,
-- con su día, su estado y sus votos. Reutilizar un plan de otro viaje habría
-- arrastrado el día del año pasado y votos de gente que este año no viene.
--
-- Se parte en dos, con la misma figura que `dishes` ↔ `dinners`: un catálogo, y
-- lo que se hace con él. `planIdeas` guarda lo que se repite; `plans` sigue
-- guardando la propuesta y añade `ideaId`, que es solo de dónde salió —al traer
-- se **copia**, no se enlaza, así que corregir el catálogo no reescribe un viaje
-- ya planeado—.
--
-- `planIdeas.eventId` es el mismo trato que el de los platos: nulo significa
-- «del catálogo de todos», con valor significa «solo de ese evento», que hoy es
-- únicamente el Demo. Decidido en `docs/diseño/planes-catalogo.html` · A3 · B3 · C1.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto6

CREATE TABLE IF NOT EXISTS planIdeas (
  id            TEXT PRIMARY KEY,
  titulo        TEXT,
  descripcion   TEXT,
  ubicacion     TEXT,
  enlace        TEXT,
  costeEstimado INTEGER,
  eventId       TEXT,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE plans ADD COLUMN ideaId TEXT;
