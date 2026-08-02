import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { personsOf, familiesOf, olvidarTodo } from '../db.js'
import Icono from '../components/Icono.jsx'
import Hoja, { HojaDeEleccion } from '../components/Hoja.jsx'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { eliminarMiCuenta, gestionarCuenta, leerIA, listarCuentas, guardarIA, registrarPush } from '../sync/api.js'
import { codigoDeAutorizacionDeApple } from '../auth/apple.js'
import { borrarSesion, leerSesion } from '../auth/sesion.js'
import { SIN_PLUGIN, estadoDePush, isNative, registerPush, tap } from '../lib/native.js'
import { ADMINISTRADOR, esAdministrador } from '../lib/admin.js'
import { avisosPara } from '../lib/avisos.js'
import { porNombre } from '../lib/asignacion.js'
import { formatearHace } from '../lib/hace.js'

/**
 * Las cuentas que han pedido entrar, y con quién es cada una.
 *
 * Antes esto era «Tu cuenta»: tu sesión, y debajo una lista de quién tenía
 * acceso a la que solo se podía añadir gente **pegando a mano un código** que el
 * aspirante te tenía que pasar por WhatsApp. Ahora quien entra con Apple queda
 * apuntado solo (`api/src/index.js`, sala de espera) con el nombre que Apple
 * entrega, y lo único que hay que decidir aquí es **quién es**: enlazarlo con
 * una persona del grupo le abre la puerta, y eliminarlo la cierra.
 *
 * Las dos cosas van juntas a propósito. Una cuenta sin persona no es alguien con
 * permisos a medias: es alguien de quien no sabemos quién es, y en una app donde
 * el reparto, las cenas y los planes cuelgan de una persona, entrar sin serlo no
 * lleva a ninguna pantalla útil.
 */
export function useCuentas() {
  const sesion = leerSesion()
  const esAdmin = esAdministrador(sesion)
  const [cuentas, setCuentas] = useState(null)
  const [error, setError] = useState(null)

  const cargar = async () => {
    if (!esAdmin) return
    try { setCuentas((await listarCuentas()).cuentas) } catch (e) { setError(String(e.message ?? e)) }
  }
  useEffect(() => { cargar() }, [esAdmin])

  return { sesion, esAdmin, cuentas, error, setError, cargar }
}

export default function CuentasSection({ eventId }) {
  const { sesion, esAdmin, cuentas, error, setError, cargar } = useCuentas()
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  // Cuenta a la que se le está eligiendo persona, o que se está borrando.
  const [enlazando, setEnlazando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [baja, setBaja] = useState(null)

  if (!sesion) return null

  const persona = (id) => persons.find((p) => p.id === id)
  const familia = (p) => families.find((f) => f.id === p?.familyId)?.name

  async function enlazar(cuentaId, personId) {
    tap()
    try {
      await gestionarCuenta({ accion: 'enlazar', id: cuentaId, personId })
      setEnlazando(null)
      cargar()
    } catch (e) { setError(String(e.message ?? e)) }
  }

  async function eliminar(cuentaId) {
    tap()
    try {
      await gestionarCuenta({ accion: 'eliminar', id: cuentaId })
      setBorrando(null)
      cargar()
    } catch (e) { setError(String(e.message ?? e)) }
  }

  async function salir() {
    tap()
    // Los datos del grupo se van con la sesión: no tiene sentido dejarlos en un
    // móvil que ya no va a poder actualizarlos.
    borrarSesion()
    await olvidarTodo()
    window.location.reload()
  }

  /**
   * Eliminar la cuenta propia. Lo exige la directriz 5.1.1(v) de la App Store:
   * quien puede crear una cuenta tiene que poder eliminarla desde dentro de la
   * app, sin escribirle a nadie.
   *
   * Se vuelve a pasar por la hoja de Apple antes, y no por ceremonia: de ahí
   * sale el código con el que el Worker le dice a Apple que este vínculo se
   * acabó. Si esa hoja se cancela o falla, la baja **sigue adelante** sin ella.
   */
  async function eliminarMia() {
    tap()
    setBaja('yendo')
    try {
      const resultado = await eliminarMiCuenta(await codigoDeAutorizacionDeApple())
      borrarSesion()
      await olvidarTodo()
      setBaja(resultado)
    } catch (e) {
      setBaja(null)
      setError(`No se pudo eliminar la cuenta: ${String(e.message ?? e)}`)
    }
  }

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="ico"><Icono nombre="llave" /></div>
          <div className="main">
            <div className="n">{sesion.cuenta?.nombre || 'Cuenta de Apple'}</div>
            <div className="sub">{esAdmin ? `Administras el grupo · ${ADMINISTRADOR.nombre}` : 'Miembro del grupo'}</div>
          </div>
          <button className="btn sm ghost" onClick={salir}>Salir</button>
        </div>
      </div>

      {esAdmin && (
        <>
          <div className="sec-h">Quién ha pedido entrar</div>
          <div className="card tight">
            {cuentas === null && <div className="empty">Cargando…</div>}
            {cuentas?.length === 0 && <div className="empty">Todavía no ha entrado nadie más.</div>}
            {cuentas?.map((c) => {
              const suya = persona(c.personId)
              return (
                <div className="row" key={c.id}>
                  <span className={`av${suya ? '' : ' sin'}`}>{suya?.avatar ?? '🔑'}</span>
                  <span className="main">
                    <span className="n">{c.nombre?.trim() || c.email || 'Sin nombre'}</span>
                    <span className="sub">
                      {suya
                        ? `es ${suya.name}${familia(suya) ? ` · ${familia(suya)}` : ''}`
                        : 'todavía no es nadie del grupo'}
                      {c.ultimoAcceso ? ` · ${formatearHace(c.ultimoAcceso)}` : ' · aún no ha entrado'}
                    </span>
                  </span>
                  <button className="btn sm ghost" onClick={() => { tap(); setEnlazando(c) }}>
                    {suya ? 'Cambiar' : 'Enlazar'}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="note">
            🐳 Quien entra con Apple aparece aquí solo, con el nombre que Apple nos da. Hasta que no
            le digas <b>quién es</b>, no entra: enlazarlo con una persona es lo que le abre la puerta.
          </div>
        </>
      )}

      {error && <div className="note" role="status">{error}</div>}

      {/* Eliminar la cuenta propia va al final y en rojo, lejos de «Salir», con
          la que se confunde a la primera mirada: una deja de sincronizar en este
          móvil y la otra deshace el acceso al grupo para siempre. */}
      <div className="sec-h">Eliminar mi cuenta</div>
      <div className="note">
        Deshace el vínculo entre tu Apple ID y el grupo, y se lo dice a Apple para que Ballena Ops
        desaparezca de «Apps que usan tu Apple ID». Los gastos, cenas y planes que apuntaste se
        quedan: son del grupo, y borrarlos descuadraría los saldos de todos los demás.
      </div>
      <button className="btn sm danger" onClick={() => { tap(); setBaja('confirmando') }}>
        Eliminar mi cuenta
      </button>

      {enlazando && (
        <HojaDeEleccion
          titulo={`¿Quién es ${enlazando.nombre?.trim() || 'esta cuenta'}?`}
          valor={enlazando.personId ?? null}
          opciones={[
            { id: null, etiqueta: '— nadie todavía —' },
            ...[...persons].sort(porNombre).map((p) => {
              const otra = cuentas?.find((c) => c.personId === p.id && c.id !== enlazando.id)
              return {
                id: p.id,
                etiqueta: `${p.avatar} ${p.name}`,
                nota: otra ? `ya es ${otra.nombre?.trim() || 'otra cuenta'}` : familia(p),
                tomada: Boolean(otra),
              }
            }),
          ]}
          onElegir={(personId) => enlazar(enlazando.id, personId)}
          onCerrar={() => setEnlazando(null)}
          extra={{ etiqueta: '🗑 Eliminar esta cuenta…', onClick: () => { setBorrando(enlazando); setEnlazando(null) } }}
        />
      )}

      {borrando && (
        <Hoja titulo="¿Eliminar la cuenta?" onCerrar={() => setBorrando(null)}>
          <div className="confirmar">
            <div className="que-se-lleva">
              Se elimina la cuenta de <b>{borrando.nombre?.trim() || 'esta persona'}</b> y sus
              dispositivos. La persona del grupo se queda: lo que desaparece es su acceso. Si vuelve
              a entrar con Apple, aparecerá otra vez aquí pidiendo permiso.
            </div>
            <div className="grid2">
              <button className="btn ghost" onClick={() => setBorrando(null)}>Dejarlo</button>
              <button className="btn danger" onClick={() => eliminar(borrando.id)}>Sí, eliminar</button>
            </div>
          </div>
        </Hoja>
      )}

      {baja && <BajaModal estado={baja} onCancelar={() => setBaja(null)} onConfirmar={eliminarMia} />}
    </>
  )
}

/**
 * Lo que está esperando a que alguien haga algo (`lib/avisos.js`).
 *
 * Hoy solo hay una clase de aviso —alguien ha entrado y todavía no es nadie— y
 * es del administrador. Se pinta derivado de la lista de cuentas, así que
 * enlazar una hace desaparecer su aviso sin que haya nada que marcar como leído.
 */
export function NotificacionesSection() {
  const { esAdmin, cuentas } = useCuentas()
  const avisos = avisosPara({ cuentas: cuentas ?? [], esAdmin })
  // 'granted' · 'denied' · 'prompt' · 'no-aplica' (web, o sin plugin).
  const [permiso, setPermiso] = useState('no-aplica')
  const [yendo, setYendo] = useState(false)

  useEffect(() => { estadoDePush().then(setPermiso) }, [])

  /**
   * El permiso se pide **aquí** y no al arrancar: al lado está escrito qué se
   * avisa, y un permiso que se pide en el primer segundo se contesta que no.
   * El token se apunta en el servidor en cuanto Apple lo da.
   */
  async function activar() {
    tap()
    setYendo(true)
    try {
      const token = await registerPush()
      if (token) await registrarPush(token, true)
      setPermiso(await estadoDePush())
    } catch (e) {
      setPermiso(e?.message === SIN_PLUGIN ? SIN_PLUGIN : 'denied')
    } finally { setYendo(false) }
  }

  return (
    <>
      {isNative() && (
        <>
          <div className="card tight">
            <div className="row">
              <div className="ico"><Icono nombre="aviso" /></div>
              <div className="main">
                <div className="n">
                  {permiso === 'granted' && 'Avisos encendidos'}
                  {permiso === SIN_PLUGIN && 'Esta instalación no puede avisar'}
                  {permiso !== 'granted' && permiso !== SIN_PLUGIN && 'Avisos apagados'}
                </div>
                <div className="sub">
                  {permiso === 'granted' && 'Este móvil recibe los avisos aunque la app esté cerrada.'}
                  {permiso === 'denied' && 'Los desactivaste en iOS: se vuelven a encender en Ajustes de iOS → Ballena Ops.'}
                  {(permiso === 'prompt' || permiso === 'prompt-with-rationale') && 'Todavía no los has encendido en este móvil.'}
                  {permiso === SIN_PLUGIN
                    && 'La app instalada se construyó antes de que existieran los avisos. Esto no se arregla desde aquí ni con «Forzar la última versión»: hace falta instalar un binario nuevo desde Xcode.'}
                </div>
              </div>
              {permiso !== 'granted' && permiso !== 'denied' && permiso !== SIN_PLUGIN && (
                <button className="btn sm" disabled={yendo} onClick={activar}>
                  {yendo ? 'Pidiendo…' : 'Encender'}
                </button>
              )}
            </div>
          </div>
          <div className="note">
            🐳 De momento se avisa de <b>una sola cosa</b>: alguien ha entrado con Apple y todavía no
            es nadie del grupo. Llega solo a quien administra, porque es quien puede arreglarlo.
          </div>
        </>
      )}

      {!esAdmin && (
        <div className="note">
          🐳 Por ahora los avisos son cosa de quien administra el grupo. Cuando haya avisos para
          todos —una cena sin anfitrión, un plan sin votar— saldrán aquí.
        </div>
      )}

      {esAdmin && avisos.length === 0 && (
        <div className="empty">Nada pendiente. Todo el mundo que ha entrado es alguien.</div>
      )}

      {avisos.length > 0 && (
        <div className="card tight">
          {avisos.map((a) => (
            <div className="row" key={a.id}>
              <span className="av sin">{a.emoji}</span>
              <span className="main">
                <span className="n">{a.titulo}</span>
                <span className="sub">{a.texto} {a.accion}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {!isNative() && (
        <div className="note">
          🐳 Los avisos al móvil solo funcionan en la app de iOS. Aquí, en el navegador, esta lista
          es lo que hay.
        </div>
      )}
    </>
  )
}

/**
 * La clave de la IA, para quien administra.
 *
 * **La clave no viaja al móvil.** Se guarda en el servidor y de vuelta solo
 * salen sus cuatro últimos caracteres y la fecha en que se puso, que es lo justo
 * para reconocer cuál está sin poder copiarla de la pantalla de nadie. Es el
 * modelo de `garciadoral-ops`: la llamada al modelo sale del Worker, donde el
 * texto se compone con lo que ya está en la base, y no del teléfono.
 */
export function IASection() {
  const { esAdmin } = useCuentas()
  const [ia, setIa] = useState(null)
  const [clave, setClave] = useState('')
  const [modelo, setModelo] = useState('')
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    if (!esAdmin) return
    leerIA()
      .then((r) => { setIa(r.ia); setModelo(r.ia.modelo) })
      .catch((e) => setAviso(String(e.message ?? e)))
  }, [esAdmin])

  if (!esAdmin) {
    return <div className="note">🐳 Esto lo lleva {ADMINISTRADOR.nombre}.</div>
  }

  async function guardar() {
    tap()
    setAviso(null)
    try {
      const r = await guardarIA({ clave: clave.trim() || undefined, modelo: modelo.trim() || undefined })
      setIa(r.ia)
      setClave('')
      setAviso('Guardado.')
    } catch (e) { setAviso(String(e.message ?? e)) }
  }

  return (
    <>
      <div className="card tight">
        <div className="row">
          <div className="ico"><Icono nombre="ballena" /></div>
          <div className="main">
            <div className="n">{ia?.hayClave ? `Clave puesta · ····${ia.cola}` : 'Sin clave'}</div>
            <div className="sub">
              {ia?.guardadaEn ? `Desde ${formatearHace(ia.guardadaEn)}` : 'Nadie ha puesto ninguna todavía'}
            </div>
          </div>
        </div>
      </div>

      <label htmlFor="ia-clave">Clave de Anthropic</label>
      <input
        id="ia-clave" type="password" value={clave} autoComplete="off"
        onChange={(e) => setClave(e.target.value)}
        placeholder={ia?.hayClave ? 'Escribe una nueva para cambiarla' : 'sk-ant-…'}
      />
      <label htmlFor="ia-modelo">Modelo</label>
      <input id="ia-modelo" type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="claude-sonnet-4-5" />

      <div className="editor-pie">
        <button className="btn" onClick={guardar}>Guardar</button>
      </div>

      {aviso && <div className="note" role="status">{aviso}</div>}
      <div className="note">
        🐳 La clave se queda en el servidor y no vuelve entera a ningún móvil — es una credencial de
        pago. Las llamadas al modelo salen del Worker, donde el texto se compone con lo que ya está
        en la base y el móvil no puede colar nada.
      </div>
    </>
  )
}

/**
 * Confirmación de la baja propia, y después su resultado.
 *
 * El resultado no se despacha con un «listo»: dice si se pudo avisar a Apple. Si
 * no se pudo —sin clave en el Worker, o la hoja de Apple cancelada—, la cuenta
 * está eliminada igual pero la aplicación sigue figurando en la lista del Apple
 * ID, y eso solo lo puede quitar su titular desde los ajustes de iOS.
 */
function BajaModal({ estado, onCancelar, onConfirmar }) {
  useBloqueoDeScroll()
  const hecha = typeof estado === 'object' && estado !== null
  const yendo = estado === 'yendo'

  return (
    <div className="modal-bg" onClick={hecha ? undefined : onCancelar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{hecha ? 'Cuenta eliminada' : '¿Eliminar tu cuenta?'}</h2>

        {hecha ? (
          <>
            <p className="note">Tu acceso al grupo ya no existe y este móvil se ha quedado vacío.</p>
            <p className="note">
              {estado.revocado_en_apple
                ? 'También se lo hemos dicho a Apple: Ballena Ops ya no figura entre las apps que usan tu Apple ID.'
                : 'No hemos podido avisar a Apple, así que Ballena Ops puede seguir apareciendo en Ajustes de iOS → tu nombre → Inicio de sesión y seguridad → Iniciar sesión con Apple. Ahí puedes quitarla.'}
            </p>
            {estado.administradores_restantes === 0 && (
              <p className="note">
                Eras la última cuenta que administraba el grupo: ya no queda nadie que pueda dar
                acceso a otros desde la app.
              </p>
            )}
            <div className="editor-pie">
              <button className="btn" onClick={() => window.location.reload()}>Cerrar</button>
            </div>
          </>
        ) : (
          <>
            <p className="note">
              Se elimina tu cuenta y los dispositivos desde los que sincronizabas. No se puede
              deshacer: para volver, alguien del grupo tendría que darte acceso otra vez.
            </p>
            <p className="note">
              Apple te va a pedir que te identifiques una vez más. Es de donde sale el permiso para
              avisarle de que te vas.
            </p>
            <div className="editor-pie">
              <button className="btn ghost" disabled={yendo} onClick={onCancelar}>Cancelar</button>
              <button className="btn danger" disabled={yendo} onClick={onConfirmar}>
                {yendo ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
