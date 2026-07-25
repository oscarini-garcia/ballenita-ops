-- Retira el evento de prueba «Ballenita 2026 (prueba)» sembrado por
-- `herramientas/sembrar-ejemplo.mjs`.
--
-- No borra físicamente: marca `borrado = 1`, igual que hace la app. Un DELETE
-- dejaría la puerta abierta a que una cola vieja de algún móvil resucitara las
-- filas en la siguiente sincronización.
--
-- Va por identificador, no por «vaciar la tabla», para que se pueda lanzar con
-- datos de verdad ya dentro sin llevárselos por delante.
--
--   cd api && npm run borrar:ejemplo

UPDATE events      SET borrado = 1, updatedAt = datetime('now') WHERE id = 'ev_demo';
UPDATE families    SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE bungas      SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE persons     SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE expenses    SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE settlements SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE dinners     SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE plans       SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';
UPDATE shop        SET borrado = 1, updatedAt = datetime('now') WHERE eventId = 'ev_demo';

-- El catálogo de platos es global y no cuelga del evento, así que se identifica
-- por su prefijo.
UPDATE dishes      SET borrado = 1, updatedAt = datetime('now') WHERE id LIKE 'dish_demo_%';
