-- El token de APNs de cada dispositivo, para poder avisar cuando la app está
-- cerrada.
--
-- Vive en `dispositivo` y no en `cuenta` porque una persona tiene un teléfono y
-- un iPad y quiere el aviso en los dos, y porque el token es de la instalación:
-- se renueva al reinstalar y muere cuando se desinstala. `avisos` es el permiso
-- tal como está en ese aparato, que es donde se concede y se retira.
ALTER TABLE dispositivo ADD COLUMN tokenPush TEXT;
ALTER TABLE dispositivo ADD COLUMN avisos INTEGER NOT NULL DEFAULT 1;
