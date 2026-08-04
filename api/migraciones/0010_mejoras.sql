-- Las mejoras: el roadmap de la app, apuntado desde el móvil.
--
-- La figura es el bloque «Mejoras» de `garciadoral-ops` y la decisión entera
-- está en `docs/diseño/mejoras.html` (A1 · B1 · C2 · D2 · E1 · F2): ideas sobre
-- la propia aplicación, que ven todos y cualquiera tacha. No se llaman «ideas»
-- porque una idea aquí es una idea de plan (`planIdeas`), y compartir nombre
-- obligaría a cada consulta a decir de cuál habla.
--
-- Es una tabla sincronizada y no una nota del móvil: sobre una mejora se actúa
-- en otra máquina, y una nota que esa máquina no lee se atiende cuando alguien
-- se acuerda de copiarla (`meeting-ops-air` lo hizo en localStorage y lo
-- deshizo). Viaja por la cola de siempre, sin ruta propia de escritura.
--
-- `hecho` va sin quién ni cuándo a propósito: eso sería un registro de trabajo
-- y esto es una lista de la compra. `autorId` es una persona del grupo, como
-- `planIdeas.creadaPor`. `apuntadaEl` la escribe el cliente al crear —`creadoEn`
-- es del servidor y no existe hasta sincronizar (§14.19-ter)—. `eventId` nulo
-- significa «de todos»; con valor, solo de ese evento, que hoy es únicamente el
-- Demo (§14.9-quater).
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto10

CREATE TABLE IF NOT EXISTS mejoras (
  id         TEXT PRIMARY KEY,
  texto      TEXT,
  hecho      INTEGER NOT NULL DEFAULT 0,
  autorId    TEXT,
  apuntadaEl TEXT,
  eventId    TEXT,
  updatedAt  TEXT NOT NULL,
  creadoEn   TEXT NOT NULL,
  borrado    INTEGER NOT NULL DEFAULT 0
);
