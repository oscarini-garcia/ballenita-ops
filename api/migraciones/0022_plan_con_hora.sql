-- La hora de un plan, y el recordatorio de una hora antes (SPECS §14.73).
--
-- **`plans.hora`** — «20:00», hora local, NULL si el plan no tiene hora. Es lo
-- que se enseña y lo que ordena el día.
--
-- **`plans.cuando`** — el mismo momento en **segundos epoch**, o NULL. Lo
-- calcula **el móvil** al guardar, no el servidor, y esa es la decisión de fondo
-- de la migración: `dia` + `hora` son tiempo **local** y el Worker corre en
-- **UTC**, así que alguien tiene que aplicar el desfase de Madrid —+2 en agosto,
-- +1 en enero—. El móvil ya sabe el suyo; el Worker tendría que deducirlo, y de
-- eso salen los fallos que solo se ven en octubre. Con el instante guardado, el
-- cron **solo compara números**. Es la misma figura que los IDs de cliente.
--
-- **`plans.avisadoEl`** — cuándo salió el recordatorio, en epoch, o NULL. Sin
-- esto el cron avisaría otra vez en cada pasada: manda cada cinco minutos, así
-- que un plan de las 20:00 dejaría **doce** avisos entre las 19:00 y las 20:00.
--
-- `hora` y `cuando` los escribe el móvil y van en `tablas.js`. **`avisadoEl` no**:
-- es del servidor, y dejarlo fuera de las columnas que acepta `aplicarCambio` es
-- lo que impide que un cliente lo borre y desate la tanda de doce.
--
-- Como las demás, no se toca `0001_esquema.sql`: aplicar todas las migraciones
-- en orden tiene que reproducir producción (`test/d1.js`).
--
--   npm run migrar:remoto22

ALTER TABLE plans ADD COLUMN hora TEXT;
ALTER TABLE plans ADD COLUMN cuando INTEGER;
ALTER TABLE plans ADD COLUMN avisadoEl INTEGER;
