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
 * Devuelve `{ estado, motivo }`, no un booleano, porque quien llama tiene que
 * poder decir **cuál de los eslabones** falta:
 * - `no-aplica` — el navegador, donde no hay avisos que valgan.
 * - `denied` · `prompt` · `sin-plugin` — el permiso, tal cual lo dice iOS.
 * - `sin-token` — permiso dado y aun así Apple no contesta en ocho segundos.
 * - `apuntado` — hecho: el servidor ya sabe a dónde mandar.
 * - `error` — con `motivo`. Aquí caen los dos fallos que **tienen palabras**:
 *   lo que contestó Apple al registro («no valid 'aps-environment' entitlement
 *   string found…» es la respuesta entera a por qué no llega ningún aviso) y lo
 *   que contestó el servidor al guardar el identificador.
 */
import { estadoDePush, isNative, registerPush } from './native.js'
import { registrarPush } from '../sync/api.js'

const porque = (e) => String(e?.message ?? e)

export async function asegurarPush({ registrar = registerPush, apuntar = registrarPush } = {}) {
  if (!isNative()) return { estado: 'no-aplica' }
  const permiso = await estadoDePush()
  if (permiso !== 'granted') return { estado: permiso }
  let token
  try {
    token = await registrar()
  } catch (e) {
    return { estado: 'error', motivo: porque(e) }
  }
  if (!token) return { estado: 'sin-token' }
  try {
    await apuntar(token, true)
  } catch (e) {
    return { estado: 'error', motivo: porque(e) }
  }
  return { estado: 'apuntado' }
}
