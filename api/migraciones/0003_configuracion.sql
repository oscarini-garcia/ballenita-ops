-- Ajustes del servidor que no son del grupo ni de nadie en concreto.
--
-- El primero es la clave de la IA, y es la razón de que esta tabla exista en vez
-- de guardarla en el móvil de quien administra: es una credencial de pago, no
-- debe viajar a ningún dispositivo, y las llamadas al modelo salen del Worker
-- —donde el texto se compone con lo que ya está en la base— y no del teléfono.
-- Es el modelo de `garciadoral-ops` (`api/src/redaccion.js`).
CREATE TABLE IF NOT EXISTS configuracion (
  clave         TEXT PRIMARY KEY,
  valor         TEXT NOT NULL DEFAULT '',
  actualizadoEn TEXT NOT NULL
);
