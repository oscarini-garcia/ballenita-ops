import { useState } from 'react'
import WhaleLogo from '../components/WhaleLogo.jsx'
import { entrarConApple } from '../auth/apple.js'
import { activarModoLocal, guardarSesion } from '../auth/sesion.js'
import { activarDemo } from '../lib/demo.js'
import { tap } from '../lib/native.js'

/**
 * Puerta de entrada al grupo.
 *
 * El acceso es solo con Apple: no hay contraseña propia que recordar ni que
 * recuperar. La incorporación es por invitación —alguien del grupo da de alta
 * tu identificador—, así que la primera vez que entra alguien nuevo la API
 * responde con su código y esta pantalla lo enseña para que lo pase por el
 * chat del grupo.
 *
 * La puerta no puede ser un muro. Cuando Apple falla por algo que no se arregla
 * desde el móvil —el binario sin la capacidad, el App ID a medias—, quedarse
 * fuera de la propia libreta el fin de semana del viaje no lo arregla nadie. De
 * ahí la salida en local: se entra a apuntar, y lo apuntado sube el día que la
 * puerta abra.
 *
 * Y una tercera puerta, que resuelve un problema **distinto** aunque se le
 * parezca: la demostración. La local es para quien es del grupo y no puede
 * entrar, y por eso arranca **vacía** y lo que se escriba en ella acaba
 * subiendo. La demostración es para quien no es del grupo —el equipo de
 * revisión de Apple, sin ir más lejos—, arranca **llena** de un camping
 * inventado y no sube nada nunca. Una app vacía no enseña lo que hace, que es
 * justo lo que hay que enseñarle a quien revisa. El porqué está en `lib/demo.js`.
 */
export default function AccesoScreen({ configuracion, onEntrar, onLocal, onDemo }) {
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState(null)
  const [identificador, setIdentificador] = useState(null)
  const [copiado, setCopiado] = useState(false)

  async function entrar() {
    tap()
    setEntrando(true)
    setError(null)
    setIdentificador(null)
    try {
      const sesion = await entrarConApple(configuracion)
      guardarSesion(sesion)
      onEntrar(sesion)
    } catch (e) {
      setError(e.message || 'No se pudo entrar.')
      if (e.identificador) setIdentificador(e.identificador)
    } finally {
      setEntrando(false)
    }
  }

  function seguirEnLocal() {
    tap()
    activarModoLocal()
    onLocal?.()
  }

  async function demostracion() {
    tap()
    onDemo?.(await activarDemo())
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(identificador)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin portapapeles: el código está a la vista para copiarlo a mano */
    }
  }

  return (
    <div className="acceso">
      <WhaleLogo className="acceso-logo" />
      <h1>Ballena Ops 🐳</h1>
      <p className="acceso-texto">
        Los gastos, las cenas y los planes del grupo. Entra con tu Apple ID;
        alguien del grupo tiene que haberte dado acceso antes.
      </p>

      <button className="btn block apple" onClick={entrar} disabled={entrando}>
        <svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16">
          <path fill="currentColor" d="M11.18 8.53c.02-1.6 1.31-2.37 1.37-2.41-.75-1.1-1.91-1.25-2.32-1.26-.99-.1-1.93.58-2.43.58-.5 0-1.27-.57-2.09-.55-1.07.02-2.06.62-2.61 1.58-1.11 1.93-.28 4.79.8 6.36.53.77 1.16 1.63 1.99 1.6.8-.03 1.1-.52 2.06-.52.96 0 1.24.52 2.08.5.86-.01 1.4-.78 1.93-1.55.61-.89.86-1.75.87-1.79-.02-.01-1.67-.64-1.65-2.54zM9.6 3.8c.44-.53.74-1.27.66-2.01-.64.03-1.41.42-1.86.95-.4.47-.76 1.22-.66 1.94.71.06 1.43-.36 1.86-.88z" />
        </svg>
        <span>{entrando ? 'Entrando…' : 'Entrar con Apple'}</span>
      </button>

      {error && (
        <div className="acceso-aviso" role="alert">
          <p>{error}</p>
          {identificador && (
            <>
              <p className="note">
                Pásale este código a quien lleve el grupo para que te dé de alta:
              </p>
              <code className="acceso-codigo">{identificador}</code>
              <button className="btn sm ghost" onClick={copiar}>
                {copiado ? '✓ copiado' : 'copiar código'}
              </button>
              {/* Que no se haya guardado nada no es un consuelo: es el motivo por
                  el que aquí no hay ningún «eliminar mi solicitud». Quien no
                  entra no deja cuenta que borrar, y conviene decirlo donde se
                  lee y no solo en la política de privacidad. */}
              <p className="note">
                Mientras tanto no hemos guardado nada tuyo: sin acceso no se crea
                ninguna cuenta ni queda registro de este intento.
              </p>
            </>
          )}
        </div>
      )}

      <button className="btn block ghost" style={{ marginTop: 12 }} onClick={seguirEnLocal}>
        Usar solo en este móvil
      </button>
      <p className="note">
        Sin entrar, Ballena Ops es tu libreta: todo funciona igual pero se queda
        aquí. Lo que apuntes se sube entero en cuanto consigas entrar, así que no
        se pierde nada por empezar así.
      </p>

      <button className="btn block ghost" onClick={demostracion}>
        Ver una demostración con datos de ejemplo
      </button>
      <p className="note">
        ¿Solo mirando? Esta abre la app con un camping inventado, para ver cómo
        funciona. No hace falta cuenta, no se conecta a nada y al salir no queda
        rastro.
      </p>
    </div>
  )
}
