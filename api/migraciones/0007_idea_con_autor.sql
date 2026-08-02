-- La idea dice quién la apuntó, y pierde dos campos que no se usaban.
--
-- `creadaPor` es una **persona del grupo** y no una cuenta: en la lista de ideas
-- lo que se quiere leer es «la apuntó Curro», y las cuentas de Apple no tienen
-- nombre hasta que alguien las enlaza. Una idea traída de la IA o importada se
-- queda sin autor, que es cierto y se dice así.
--
-- `ubicacion` y `costeEstimado` se retiran: el sitio ya cabía en la descripción
-- y el coste no se usó nunca. SQLite no deja quitar una columna sin rehacer la
-- tabla, y rehacerla por dos campos vacíos no compensa: dejan de declararse en
-- `tablas.js`, así que ni se leen ni se escriben ni viajan.
--
--   npm run migrar:remoto7

ALTER TABLE planIdeas ADD COLUMN creadaPor TEXT;
