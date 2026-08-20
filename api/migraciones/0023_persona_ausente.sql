-- Quien se va unos días (SPECS §14.78).
--
-- Una columna y no dos fechas: se pidió **sin límite de tiempo**, y unas fechas
-- de ida y vuelta obligarían a decidir qué pasa con un gasto apuntado el martes
-- por alguien que se fue el miércoles. Aquí no hay nada que decidir: cuenta o no
-- cuenta, y se cambia con un interruptor.
--
-- Nulo = está. Así las filas de antes de esta migración quedan bien sin tocarlas
-- y nadie desaparece de un reparto sin que alguien lo haya pedido.
ALTER TABLE persons ADD COLUMN ausente INTEGER;
