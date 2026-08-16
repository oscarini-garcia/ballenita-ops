-- El bunga, resumido en una línea con guasa (SPECS §14.66).
--
-- **`alojamientos.resumen`** — la frase que sale bajo el nombre de cada bunga en
-- la lista, escrita por el modelo a partir de sus pegatinas y de sus notas.
--
-- Va en el **alojamiento** y no en el bunga del evento porque es de lo que no
-- cambia de un año a otro: cómo es el sitio. El de 2026 y el de 2027 son la
-- misma nevera que congela.
--
-- **Y se guarda porque es de pago.** La alternativa —pedirlo al pintar la
-- lista— serían nueve teléfonos llamando cada vez que alguien abre Grupo, para
-- leer nueve bromas distintas sobre la misma nevera. Así lo pide uno, lo
-- guarda la cola de cambios de siempre, y lo leen los nueve.
--
-- **`resumenDe`** es la huella de las notas y las pegatinas con las que se
-- escribió. Sin ella, un resumen que ya no dice la verdad —porque alguien
-- apuntó después «se ha roto el aire»— es indistinguible de uno recién hecho, y
-- eso en una lista que se mira para decidir es peor que no tener ninguno. Con
-- ella, la app lo marca como viejo y ofrece rehacerlo.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto19

ALTER TABLE alojamientos ADD COLUMN resumen TEXT;
ALTER TABLE alojamientos ADD COLUMN resumenDe TEXT;
