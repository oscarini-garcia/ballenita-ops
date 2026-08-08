import { useEffect, useRef, useState } from 'react'
import WhaleLogo from '../components/WhaleLogo.jsx'
import Hoja from '../components/Hoja.jsx'
import { entrarConApple } from '../auth/apple.js'
import { activarModoLocal, guardarSesion } from '../auth/sesion.js'
import { guardarEspera, leerEspera, olvidarEspera, preguntarSiYaEntro } from '../auth/espera.js'
import { activarDemo } from '../lib/demo.js'
import { tap } from '../lib/native.js'
import { forzarActualizacion } from '../lib/pwa.js'

/**
 * Puerta de entrada al grupo.
 *
 * El acceso es solo con Apple: no hay contraseña propia que recordar ni que
 * recuperar. La incorporación es por invitación —alguien del grupo da de alta
 * tu identificador—, así que quien llega nuevo queda apuntado en una sala de
 * espera hasta que le enlacen con su persona.
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
 * inventado y no sube nada nunca. El porqué está en `lib/demo.js`.
 *
 * ── Una puerta y un pie (SPECS §14.29, `docs/diseño/acceso.html` · A3) ──────
 *
 * Las tres salidas de arriba venían cada una con su párrafo debajo, y entre los
 * tres párrafos y el de la cabecera sumaban **353,8 pt de prosa**: el 39 % de
 * una puerta de 909,2 que no cabía en los 844 de un iPhone. Y `.acceso` no hacía
 * scroll, así que lo que sobraba no se apartaba: se **recortaba** por los dos
 * extremos a la vez.
 *
 * Ahora la pantalla dice tres cosas —quién eres, qué es esto en una línea, y
 * «Entrar con Apple»— y las otras tres salidas son renglones de un pie. Cada uno
 * **abre su hoja**, con el texto entero y su botón: es donde de verdad se lee,
 * sin prisa y sin competir con la puerta. Lo que se paga es un toque más para
 * quien necesita el modo local; lo que se gana es que la puerta quepa entera en
 * las tres tallas de letra y que «Entrar con Apple» esté siempre a la vista.
 *
 * La segunda frase de la cabecera —«alguien del grupo tiene que haberte dado
 * acceso antes»— baja **debajo** del botón de Apple. Es donde importa: se lee
 * cuando Apple ya ha fallado, no antes de intentarlo.
 */

// Lo que explica cada salida, junto al verbo que la ejecuta. Vive en una tabla
// porque las tres hojas son la misma hoja con distinto texto, y tenerlas sueltas
// era lo que hacía fácil que una se quedara sin actualizar.
const SALIDAS = {
  local: {
    titulo: 'Usar solo en este móvil',
    // El verbo no repite el rótulo del renglón que abrió la hoja: repetido, no
    // se sabe si es el mismo botón otra vez o el que confirma.
    verbo: 'Seguir solo en este móvil',
    texto:
      'Sin entrar, Ballena Ops es tu libreta: todo funciona igual pero se queda aquí. '
      + 'Lo que apuntes se sube entero en cuanto consigas entrar, así que no se pierde '
      + 'nada por empezar así.',
  },
  demo: {
    titulo: 'Ver una demostración',
    verbo: 'Abrir la demostración',
    texto:
      '¿Solo mirando? Esta abre la app con un camping inventado, para ver cómo funciona. '
      + 'No hace falta cuenta, no se conecta a nada y al salir no queda rastro.',
  },
  version: {
    titulo: 'Buscar la última versión',
    verbo: 'Buscar ahora',
    texto:
      'Trae la última versión publicada y recarga. Sirve aquí mismo, sin entrar: si lo '
      + 'que falla es esta pantalla, no hace falta entrar para poder arreglarla.',
  },
}

// Cada cuánto vuelve a preguntar la sala de espera. Veinte segundos es corto
// para quien está mirando la pantalla esperando y largo para el servidor: quien
// espera tiene la app abierta y delante, y son tres peticiones por minuto.
export const CADA = 20_000

export default function AccesoScreen({ configuracion, onEntrar, onLocal, onDemo, intervalo = CADA }) {
  const [entrando, setEntrando] = useState(false)
  const [error, setError] = useState(null)
  const [identificador, setIdentificador] = useState(null)
  const [copiado, setCopiado] = useState(false)
  // La sala de espera **se recuerda entre arranques**: la solicitud está hecha
  // en el servidor, y volver a enseñar la puerta al reabrir la app se lee como
  // si no lo hubieras intentado nunca.
  const [espera, setEspera] = useState(leerEspera)
  const [mirando, setMirando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [hoja, setHoja] = useState(null)

  async function entrar() {
    tap()
    setEntrando(true)
    setError(null)
    setIdentificador(null)
    try {
      const sesion = await entrarConApple(configuracion)
      olvidarEspera()
      setEspera(null)
      guardarSesion(sesion)
      onEntrar(sesion)
    } catch (e) {
      if (e.enEspera) setEspera(guardarEspera({ nombre: e.nombre, pase: e.pase }) ?? { nombre: e.nombre })
      else {
        setError(e.message || 'No se pudo entrar.')
        if (e.identificador) setIdentificador(e.identificador)
      }
    } finally {
      setEntrando(false)
    }
  }

  /**
   * «¿Ya me han dejado entrar?», sin pasar por Apple (§14.29 · B4).
   *
   * Devuelve si hay que seguir preguntando, para que el reloj de abajo se pare
   * solo cuando ya no tiene sentido seguir.
   */
  async function mirarLaEspera(pase) {
    const respuesta = await preguntarSiYaEntro(configuracion, pase)

    if (respuesta.estado === 'dentro') {
      olvidarEspera()
      setEspera(null)
      guardarSesion(respuesta)
      onEntrar(respuesta)
      return false
    }
    // La solicitud ya no existe —la han eliminado, o el pase no vale—: se vuelve
    // a la puerta, que es donde se consigue uno nuevo.
    if (respuesta.estado === 'desconocida') {
      olvidarEspera()
      setEspera(null)
      return false
    }
    if (respuesta.estado === 'desactivada') {
      olvidarEspera()
      setEspera(null)
      setError('Tu acceso al grupo está desactivado. Habla con quien lleva el grupo.')
      return false
    }
    // `espera` y `sin-respuesta` se quedan igual. Que la red falle un momento no
    // es una noticia que dar aquí: lo único que cambia es que se sigue esperando.
    if (respuesta.nombre) setEspera((v) => (v ? { ...v, nombre: respuesta.nombre } : v))
    return true
  }

  // El reloj de la sala de espera. Se monta solo mientras hay una espera con
  // pase y se para en cuanto deja de haberla, que es lo que hace que no siga
  // preguntando por una solicitud que ya se resolvió.
  const pase = espera?.pase
  const alEntrar = useRef(null)
  alEntrar.current = mirarLaEspera
  useEffect(() => {
    if (!pase) return undefined
    let vivo = true
    const reloj = setInterval(async () => {
      if (!vivo || document.visibilityState === 'hidden') return
      const seguir = await alEntrar.current(pase)
      if (!seguir) clearInterval(reloj)
    }, intervalo)
    return () => { vivo = false; clearInterval(reloj) }
  }, [pase, intervalo])

  async function mirarAhora() {
    if (mirando) return
    tap()
    setMirando(true)
    await alEntrar.current(pase)
    setMirando(false)
  }

  function seguirEnLocal() {
    tap()
    activarModoLocal()
    onLocal?.()
  }

  async function actualizar() {
    if (buscando) return
    tap()
    setBuscando(true)
    await forzarActualizacion(() => {}, {}).catch(() => {})
    setBuscando(false)
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

  const ejecutar = { local: seguirEnLocal, demo: demostracion, version: actualizar }

  // El pie de las tres salidas. Es el mismo en la puerta y en la sala de espera,
  // salvo que allí no se ofrece la demostración: quien ya está apuntado no está
  // mirando la app por curiosidad.
  const pie = (salidas) => (
    <div className="acceso-pie">
      {salidas.map((id) => (
        <button key={id} type="button" className="acceso-salida" onClick={() => { tap(); setHoja(id) }}>
          {SALIDAS[id].titulo}
        </button>
      ))}
    </div>
  )

  const laHoja = hoja && (
    <Hoja titulo={SALIDAS[hoja].titulo} onCerrar={() => setHoja(null)}>
      <p className="hoja-texto">{SALIDAS[hoja].texto}</p>
      <button
        className="btn block"
        style={{ marginTop: 14 }}
        disabled={hoja === 'version' && buscando}
        onClick={() => { ejecutar[hoja]() }}
      >
        {hoja === 'version' && buscando ? 'Buscando…' : SALIDAS[hoja].verbo}
      </button>
    </Hoja>
  )

  // ── La sala de espera **es** la pantalla (§14.29 · B2) ────────────────────
  //
  // Antes se apilaba encima de la puerta entera: 369,7 pt de tarjeta sumados a
  // los 909 de una puerta que ya no cabía. Y lo que se leía primero era la
  // explicación de cómo entrar, dirigida a alguien que ya lo ha intentado y no
  // puede. Ahora, si estás en la lista, eso es lo que dice la pantalla, y el
  // botón grande deja de ser «Entrar con Apple» —que aquí no hace nada— para ser
  // el único que sirve. La puerta vuelve sola en cuanto la espera se resuelve.
  if (espera) {
    return (
      <div className="acceso">
        <WhaleLogo className="acceso-logo chico" />
        <h1 className="acceso-titulo-corto">Ya estás en la lista</h1>
        <p className="acceso-texto">
          {espera.nombre
            ? <>Le hemos dicho a quien lleva el grupo que eres <b>{espera.nombre}</b>. En cuanto te enlace con tu persona, entras.</>
            : <>Quien lleva el grupo tiene que decir quién eres. En cuanto te enlace con tu persona, entras.</>}
        </p>

        <button className="btn block" onClick={mirarAhora} disabled={mirando || !pase}>
          {mirando ? 'Mirando…' : '¿Ya me han dejado entrar?'}
        </button>

        <p className="note">
          {pase
            ? 'No hay nada más que hacer desde aquí: estamos mirando solos cada pocos segundos y la app entrará sola en cuanto te dejen pasar.'
            : 'No hay nada más que hacer desde aquí. Vuelve a mirar de vez en cuando.'}
          {' '}Mientras tanto puedes usar la app solo en este móvil: lo que apuntes se subirá entero
          en cuanto te dejen pasar.
        </p>

        {pie(['local', 'version'])}
        {laHoja}
      </div>
    )
  }

  return (
    <div className="acceso">
      <WhaleLogo className="acceso-logo" grande />
      <h1>Ballena Ops 🐳</h1>
      <p className="acceso-texto">Los gastos, las cenas y los planes del grupo.</p>

      <button className="btn block apple" onClick={entrar} disabled={entrando}>
        <svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16">
          <path fill="currentColor" d="M11.18 8.53c.02-1.6 1.31-2.37 1.37-2.41-.75-1.1-1.91-1.25-2.32-1.26-.99-.1-1.93.58-2.43.58-.5 0-1.27-.57-2.09-.55-1.07.02-2.06.62-2.61 1.58-1.11 1.93-.28 4.79.8 6.36.53.77 1.16 1.63 1.99 1.6.8-.03 1.1-.52 2.06-.52.96 0 1.24.52 2.08.5.86-.01 1.4-.78 1.93-1.55.61-.89.86-1.75.87-1.79-.02-.01-1.67-.64-1.65-2.54zM9.6 3.8c.44-.53.74-1.27.66-2.01-.64.03-1.41.42-1.86.95-.4.47-.76 1.22-.66 1.94.71.06 1.43-.36 1.86-.88z" />
        </svg>
        <span>{entrando ? 'Entrando…' : 'Entrar con Apple'}</span>
      </button>
      <p className="note">Alguien del grupo tiene que haberte dado acceso antes.</p>

      {error && (
        <div className="acceso-aviso" role="alert">
          <p>{error}</p>
          {identificador && (
            <>
              <p className="acceso-pista">
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
              <p className="acceso-pista">
                Mientras tanto no hemos guardado nada tuyo: sin acceso no se crea
                ninguna cuenta ni queda registro de este intento.
              </p>
            </>
          )}
        </div>
      )}

      {pie(['local', 'demo', 'version'])}
      {laHoja}
    </div>
  )
}
