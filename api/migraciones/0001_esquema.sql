-- Esquema de Ballena Ops sobre D1.
--
-- Dos familias de tablas:
--
--   · `cuenta` y `dispositivo`, que son del servidor: quién entra y desde dónde.
--   · el resto, que son el registro del grupo y se sincronizan con los móviles.
--
-- Las columnas se llaman igual que los campos del cliente (`eventId`,
-- `amountCents`, `updatedAt`) para que no haga falta traducir nombres entre la
-- base y la PWA; la razón está en `src/tablas.js`.
--
-- Nada se borra físicamente: `borrado = 1` marca la fila y deja de transmitirse.
-- Un borrado físico volvería a aparecer en cuanto otro móvil subiera una cola
-- vieja que aún mencionara esa fila.

-- --------------------------------------------------------------------------
-- Identidad
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cuenta (
  id           TEXT PRIMARY KEY,
  appleSub     TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL DEFAULT '',
  email        TEXT,
  -- 'administrador' puede dar de alta a otras cuentas; 'miembro' solo usa la app.
  rol          TEXT NOT NULL DEFAULT 'miembro',
  activa       INTEGER NOT NULL DEFAULT 1,
  creadoEn     TEXT NOT NULL,
  ultimoAcceso TEXT
);

CREATE TABLE IF NOT EXISTS dispositivo (
  id                   TEXT PRIMARY KEY,
  cuentaId             TEXT NOT NULL REFERENCES cuenta(id),
  plataforma           TEXT,
  ultimaSincronizacion TEXT
);

-- --------------------------------------------------------------------------
-- Registro del grupo
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  lugar     TEXT,
  currency  TEXT,
  startDate TEXT,
  endDate   TEXT,
  status    TEXT,
  -- El evento de demostración: un cajón de arena. Ver 0002.
  esDemo    INTEGER NOT NULL DEFAULT 0,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS families (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  name      TEXT,
  color     TEXT,
  avatar    TEXT,
  estado    TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bungas (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  name      TEXT,
  alias     TEXT,
  familyId  TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS persons (
  id                      TEXT PRIMARY KEY,
  eventId                 TEXT,
  name                    TEXT,
  apodo                   TEXT,
  familyId                TEXT,
  edad                    TEXT,
  comeConMayores          INTEGER,
  cuentaComoAdultoReparto INTEGER,
  pesoReparto             REAL,
  avatar                  TEXT,
  estado                  TEXT,
  updatedAt               TEXT NOT NULL,
  creadoEn                TEXT NOT NULL,
  borrado                 INTEGER NOT NULL DEFAULT 0
);

-- `payers` y `participantIds` son JSON: pertenecen al gasto y no se consultan
-- por separado. Quien reparte es `lib/reparto.js` en el cliente, no SQL.
CREATE TABLE IF NOT EXISTS expenses (
  id             TEXT PRIMARY KEY,
  eventId        TEXT,
  description    TEXT,
  amountCents    INTEGER,
  currency       TEXT,
  amountOriginal REAL,
  rate           REAL,
  category       TEXT,
  dateISO        TEXT,
  payers         TEXT,
  participantIds TEXT,
  updatedAt      TEXT NOT NULL,
  creadoEn       TEXT NOT NULL,
  borrado        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settlements (
  id            TEXT PRIMARY KEY,
  eventId       TEXT,
  dateISO       TEXT,
  fromFamilyId  TEXT,
  toFamilyId    TEXT,
  amountCents   INTEGER,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

-- Catálogo global de platos: la única tabla que no cuelga de un evento, para
-- poder reutilizar la paella del año pasado en el viaje de este.
CREATE TABLE IF NOT EXISTS dishes (
  id           TEXT PRIMARY KEY,
  name         TEXT,
  categorias   TEXT,
  esFavorito   INTEGER,
  ingredientes TEXT,
  -- NULL = catálogo compartido entre eventos, que es lo normal. Con valor, el
  -- plato es solo de ese evento (hoy, solo el Demo). Ver 0002.
  eventId      TEXT,
  updatedAt    TEXT NOT NULL,
  creadoEn     TEXT NOT NULL,
  borrado      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dinners (
  id              TEXT PRIMARY KEY,
  eventId         TEXT,
  dia             TEXT,
  platoIds        TEXT,
  bungaMayoresId  TEXT,
  bungaNinosId    TEXT,
  queSeHace       TEXT,
  cantidades      TEXT,
  updatedAt       TEXT NOT NULL,
  creadoEn        TEXT NOT NULL,
  borrado         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  eventId       TEXT,
  titulo        TEXT,
  descripcion   TEXT,
  dia           TEXT,
  costeEstimado INTEGER,
  ubicacion     TEXT,
  enlace        TEXT,
  estado        TEXT,
  votos         TEXT,
  updatedAt     TEXT NOT NULL,
  creadoEn      TEXT NOT NULL,
  borrado       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS shop (
  id          TEXT PRIMARY KEY,
  eventId     TEXT,
  texto       TEXT,
  categoria   TEXT,
  comprado    INTEGER,
  compradoPor TEXT,
  compradoEn  TEXT,
  updatedAt   TEXT NOT NULL,
  creadoEn    TEXT NOT NULL,
  borrado     INTEGER NOT NULL DEFAULT 0
);

-- Todas las lecturas de la sincronización son «lo vivo de este evento», así que
-- el índice útil es el mismo en todas partes.
CREATE INDEX IF NOT EXISTS idx_families_evento    ON families(eventId)    WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_bungas_evento      ON bungas(eventId)      WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_persons_evento     ON persons(eventId)     WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_expenses_evento    ON expenses(eventId)    WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_settlements_evento ON settlements(eventId) WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_dinners_evento     ON dinners(eventId)     WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_plans_evento       ON plans(eventId)       WHERE borrado = 0;
CREATE INDEX IF NOT EXISTS idx_shop_evento        ON shop(eventId)        WHERE borrado = 0;
