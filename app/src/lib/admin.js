/**
 * Quién manda aquí, y por qué está escrito a mano.
 *
 * Este grupo tiene **un solo administrador y siempre el mismo**. Ponerlo en el
 * código en vez de deducirlo de la base no es un atajo: la cuenta que abre una
 * instalación vacía nace administradora (`api/src/index.js`), así que sin esto
 * el rol dependería de quién llegó primero, y en una app donde el administrador
 * decide quién entra, eso es la clase de detalle que nadie recuerda haber
 * decidido.
 *
 * El nombre no da permisos —los da el `rol` de la sesión, que firma el Worker—:
 * sirve para **decir en pantalla de quién se está hablando**, que es lo que le
 * falta a un «reservado a administradores» a secas.
 */
export const ADMINISTRADOR = { nombre: 'Óscar García Chillón' }

/** El rol viene firmado en la sesión; aquí no se decide nada, solo se lee. */
export const esAdministrador = (sesion) => sesion?.cuenta?.rol === 'administrador'
