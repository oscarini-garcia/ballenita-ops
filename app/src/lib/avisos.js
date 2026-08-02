/**
 * Lo que está esperando a que alguien haga algo.
 *
 * **Un aviso es una función de lo que hay, no una fila.** No hay tabla de avisos
 * y no debe haberla: si un aviso fuera algo escrito, enlazar una cuenta desde
 * Ajustes dejaría su fila ahí mintiendo y habría que ir a borrarla. Derivado, el
 * aviso desaparece porque ya no hay nada que hacer. Es la figura de `avisos.js`
 * en `garciadoral-ops`, y el motivo de escribirla aparte aunque hoy quepa en una
 * función: cuando lleguen las notificaciones remotas, el servidor tendrá que
 * contestar esta misma pregunta para saber qué empujar, y si vive dentro de una
 * pantalla habrá que escribirla dos veces, con la garantía de que un día dirán
 * cosas distintas.
 *
 * Hoy la app **no tiene push** —se retiraron OneSignal y el plugin de Capacitor,
 * y el porqué está en `lib/native.js`—, así que el aviso se ve al abrir Ajustes.
 * Cuando lo haya, esta lista es exactamente la que se empuja.
 */

/**
 * Quién ha entrado y todavía no es nadie.
 *
 * Es el único aviso que hay por ahora, y es del administrador: una cuenta sin
 * persona enlazada no puede usar la app —no tiene con qué pagar, ni con qué
 * cenar, ni a quién apuntarle un gasto—, así que se queda esperando sin que
 * nadie se entere. Ahora se entera.
 */
export function avisosDeCuentas(cuentas = []) {
  return cuentas
    .filter((c) => !c.personId)
    .map((c) => ({
      id: `cuenta:${c.id}`,
      emoji: '🔑',
      titulo: c.nombre?.trim() || 'Alguien sin nombre',
      texto: 'ha entrado con Apple y todavía no es nadie del grupo.',
      accion: 'Enlázalo con una persona en Cuentas.',
      cuando: c.creadoEn ?? null,
    }))
}

/** Todos los avisos que le tocan a quien mira, en una lista. */
export function avisosPara({ cuentas = [], esAdmin = false } = {}) {
  return esAdmin ? avisosDeCuentas(cuentas) : []
}
