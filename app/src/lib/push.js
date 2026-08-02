/**
 * Que el servidor sepa a qué aparato mandar, sin que nadie lo pida.
 *
 * El permiso de iOS y el **identificador de APNs no son la misma cosa**, y en
 * pantalla lo parecían: «Avisos encendidos» y, debajo, «este móvil todavía no ha
 * apuntado su identificador». Pasó de verdad, y el callejón sin salida era
 * completo: `registerPush()` solo se llamaba desde el botón «Encender», y ese
 * botón **desaparece justo cuando el permiso ya está dado**. Con el permiso
 * concedido y el token sin guardar —porque se instaló un binario nuevo, porque
 * el móvil se restauró, o porque aquella vez falló la subida— no quedaba ningún
 * gesto en la app capaz de arreglarlo.
 *
 * Además el token de APNs **caduca y cambia**: reinstalar, restaurar una copia o
 * actualizar iOS lo renueva, y el viejo empieza a devolver `BadDeviceToken`. Lo
 * que Apple espera es justo esto: pedirlo en cada arranque y volver a apuntarlo.
 * Es barato —`guardarTokenPush` reescribe la misma fila— y silencioso: con el
 * permiso ya concedido no aparece ninguna hoja.
 *
 * Devuelve una palabra, no un booleano, porque quien llama tiene que poder
 * decir **cuál de los eslabones** falta:
 * - `no-aplica` — el navegador, donde no hay avisos que valgan.
 * - `granted` no llega a devolverse: si el permiso está, se sigue.
 * - `denied` · `prompt` · `sin-plugin` — el permiso, tal cual lo dice iOS.
 * - `sin-token` — permiso dado y aun así Apple no devuelve identificador. Es el
 *   síntoma de un binario sin `aps-environment`, o de estar sin red.
 * - `apuntado` — hecho: el servidor ya sabe a dónde mandar.
 * - `error` — la subida al servidor falló. No se toca la pantalla por esto.
 */
import { estadoDePush, isNative, registerPush } from './native.js'
import { registrarPush } from '../sync/api.js'

export async function asegurarPush({ registrar = registerPush, apuntar = registrarPush } = {}) {
  if (!isNative()) return 'no-aplica'
  const permiso = await estadoDePush()
  if (permiso !== 'granted') return permiso
  let token
  try {
    token = await registrar()
  } catch {
    // `sin-plugin` con el permiso puesto es imposible en un binario sano, y de
    // todas formas aquí no hay a quién contárselo: esto corre solo al arrancar.
    return 'error'
  }
  if (!token) return 'sin-token'
  try {
    await apuntar(token, true)
  } catch {
    return 'error'
  }
  return 'apuntado'
}
