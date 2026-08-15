-- El registro: qué ha hecho cada uno, para el recap del final (SPECS §14.50).
--
-- Es una tabla sincronizada y no un log del móvil porque la gracia está en
-- **juntar**: un recap que solo cuenta lo que tecleaste tú no es un recap. Viaja
-- por la cola de siempre, sin ruta propia de escritura, como `mejoras`.
--
-- `texto` llega **ya compuesto** desde el móvil que hizo la cosa, y el Worker no
-- lo rehace. La frase depende de cómo estaba la fila en ese momento —«borró “Cena
-- del sábado”»— y una cena borrada en agosto no puede volver a decir de qué día
-- era. Rehacerlo aquí obligaría además a que el servidor supiera de cenas, de
-- planes y de la compra, que es justo lo que la regla de oro no quiere.
--
-- `tabla` y `filaId` no los mira el recap: están para que el cliente reconozca
-- «esto es lo mismo otra vez» y actualice el renglón en vez de añadir otro
-- (`MISMA_COSA_MS`). Sin eso, corregir un gasto cuatro veces son cuatro
-- renglones y el recap lo escribe quien más dudó al teclear.
--
-- `personId` es una persona del grupo, como `planIdeas.creadaPor`. Puede ser
-- NULL: en la libreta local y en la demostración no hay nadie elegido, y un
-- renglón sin dueño sigue contando qué pasó.
--
-- `cuando` la escribe el cliente, no el servidor: es cuándo se hizo la cosa, y
-- `creadoEn` es cuándo llegó aquí — con la app sin red pueden ser días distintos.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto15

CREATE TABLE IF NOT EXISTS registro (
  id        TEXT PRIMARY KEY,
  eventId   TEXT,
  personId  TEXT,
  tabla     TEXT,
  filaId    TEXT,
  accion    TEXT,
  clase     TEXT,
  texto     TEXT,
  cuando    TEXT,
  updatedAt TEXT NOT NULL,
  creadoEn  TEXT NOT NULL,
  borrado   INTEGER NOT NULL DEFAULT 0
);

-- El recap se lee siempre por evento y por fecha, y esta tabla es la única que
-- crece con cada toque: sin índice, un viaje de mil renglones recorre la tabla
-- entera cada vez que alguien abre Números.
CREATE INDEX IF NOT EXISTS idx_registro_evento ON registro (eventId, cuando);
