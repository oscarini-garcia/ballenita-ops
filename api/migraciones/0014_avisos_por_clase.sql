-- Qué avisos quiere recibir cada cuenta (SPECS §14.39).
--
-- **`cuenta.avisosClases`** — un JSON con las clases apagadas a mano, p. ej.
-- `{"estado":false}`. Lo que no está nombrado está encendido: así una clase
-- nueva llega encendida a todo el mundo sin tener que tocar ninguna fila, que es
-- lo contrario de guardar la lista de las que sí se quieren.
--
-- **No va en `dispositivo`**, donde ya vive `avisos`, porque son dos cosas
-- distintas y se retiran en sitios distintos: `dispositivo.avisos` es el permiso
-- del sistema en ese aparato —se da y se quita en iOS— y esto es qué te interesa
-- saber, que es de la persona y vale igual en el móvil y en el iPad. Mezclarlas
-- obligaría a apagar «los estados» dos veces a quien tiene dos aparatos.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto14

ALTER TABLE cuenta ADD COLUMN avisosClases TEXT;
