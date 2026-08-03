-- Cantidades en las recetas, y la compra que sale de ellas (SPECS §14.20).
--
-- `dishes.raciones` es para cuántos es la receta, sin lo cual una cantidad no se
-- puede estirar: «2 kg» no se reparte entre dos mesas porque falta el
-- denominador. Los ingredientes pasan de nombres sueltos a objetos con cantidad,
-- unidad y lote de compra, y siguen viviendo en la misma columna JSON: lo que
-- había guardado se lee como líneas sin cantidad, que es lo que son.
ALTER TABLE dishes ADD COLUMN raciones REAL;

-- La mesa de niños puede comer otra cosa. En NULL hereda la lista de arriba, que
-- es la noche normal y la que no hay que escribir dos veces.
ALTER TABLE dinners ADD COLUMN platoIdsNinos TEXT;

-- De dónde sale cada línea de la compra. `mano` es lo de siempre y no se toca
-- nunca al recalcular; `cena` viene de una receta y es lo único que se rehace
-- solo. `clave` empareja la línea con su ingrediente entre recálculos.
ALTER TABLE shop ADD COLUMN origen TEXT NOT NULL DEFAULT 'mano';
ALTER TABLE shop ADD COLUMN clave TEXT;
ALTER TABLE shop ADD COLUMN cantidad REAL;
ALTER TABLE shop ADD COLUMN unidad TEXT NOT NULL DEFAULT '';
ALTER TABLE shop ADD COLUMN desglose TEXT;
ALTER TABLE shop ADD COLUMN cambio TEXT;
