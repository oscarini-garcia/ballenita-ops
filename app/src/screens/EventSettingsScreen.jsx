import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  familiesOf, personsOf, olvidarTodo, listEvents,
  updateEvent, dinnersOf, plansOf, expensesOf, removeDinner, removePlan,
  listMejoras,
} from '../db.js'
import MejorasSection from './MejorasSection.jsx'
import Acordeon from '../components/Acordeon.jsx'
import Icono from '../components/Icono.jsx'
import { estadoSync } from '../components/SyncDot.jsx'
import { ListaDePasos } from '../components/ProgresoModal.jsx'
import { formatearHace } from '../lib/hace.js'
import { NOTAS } from '../lib/notas.js'
import { COCINA_DE_ORIGEN } from '../lib/cocina.js'
import { comprobarAntesDeSalir, avisoDeSalida } from '../lib/salida.js'
import CuentasSection, { IASection, NotificacionesSection, useCuentas } from './CuentasSection.jsx'
import Hoja from '../components/Hoja.jsx'
import { loQueSeCaeFuera, enPalabras } from '../lib/evento.js'
import { finPara } from '../lib/fechas.js'
import { useTema, TEMAS } from '../lib/tema.js'
import { useTamano, TAMANOS } from '../lib/tamano.js'
import { useIdentidad } from '../lib/identidad.js'
import { useBloqueoDeScroll } from '../lib/scrollLock.js'
import { aplicarSiguienteMigracion, eliminarMiCuenta, gestionarCuenta, hayApi, leerMigraciones, listarCuentas } from '../sync/api.js'
import { codigoDeAutorizacionDeApple } from '../auth/apple.js'
import { borrarSesion, leerSesion, modoLocal, salirDeModoLocal } from '../auth/sesion.js'
import { esAdministrador } from '../lib/admin.js'
import { tap } from '../lib/native.js'
import { avisosPara } from '../lib/avisos.js'
import { forzarActualizacion, marcarPostActualizacion, veniaDeActualizar, limpiarMarcaActualizacion, UPDATE_STEPS } from '../lib/pwa.js'
import { checkForOtaUpdate, estadoDelPaquete, isNative, versionInstalada } from '../lib/native.js'

// Lo que la lista terminada se queda en pantalla antes de recargar, para poder
// leerla. Cinco segundos es el rato en que se lee «instalada» sin que dé tiempo
// a impacientarse.
const ESPERA_FINAL = 5000

// El orden real del proceso (lib/pwa.js), para pintarlo como lista y que se vea
// por dónde va en vez de un solo rótulo que parpadea.
const PASOS_APP = ['checking', 'downloading', 'applying']

// Inyectada por Vite (define). Guarda por si el global no existe (p. ej. en tests).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'

/**
 * Qué ha contestado el paquete OTA, en palabras y con qué hacer al respecto.
 *
 * `checkForOtaUpdate` devuelve cuatro cosas además de «actualizado», y las
 * cuatro acababan en la basura: el botón seguía con el camino del service
 * worker —que dentro de la app de iOS no trae nada— y terminaba con su ✓. La
 * pantalla decía que sí y el teléfono se quedaba en la de antes.
 *
 * Cada motivo dice **dónde** está el problema, porque están en sitios
 * distintos: en el manifiesto, en la red, o en que ya la tienes.
 */
export function motivoDelOta(ota = {}) {
  if (ota.status === 'up-to-date') {
    return `Ya tienes el último paquete${ota.version ? ` (v${ota.version})` : ''}. Si esperabas otro, es que todavía no se ha publicado: mira si el release ota-v… existe.`
  }
  if (ota.status === 'no-manifest') {
    return 'No se ha podido leer el manifiesto (releases/latest/download/latest.json). O no hay red, o todavía no hay ningún release publicado.'
  }
  if (ota.status === 'armed') {
    return `El paquete v${ota.version} queda puesto para el próximo arranque.`
  }
  if (ota.status === 'skip') {
    return 'Aquí no hay paquete que traer: los OTA son de la app de iOS.'
  }
  return `No se ha podido traer el paquete: ${ota.error || 'sin motivo'}`
}

/**
 * De los cinco desenlaces, **tres no son un fallo**: ya la tienes, queda puesta
 * para el próximo arranque, o esto es la web y aquí no hay paquete que traer.
 *
 * La traza los pintaba los cinco en rojo, porque la variable que los guardaba se
 * llamaba `fallo` y el rojo venía detrás del nombre. Leer en rojo «ya tienes el
 * último paquete» dice lo contrario de lo que ha pasado, y el rojo en esta app
 * es deuda y borrar: gastarlo en la respuesta normal del botón lo deja sin
 * significar nada el día que sí falle algo. Los nombres de las pruebas de
 * `Actualizar.test.jsx` ya decían «no es un fallo» desde que se escribieron.
 */
const OTA_SIN_FALLO = new Set(['up-to-date', 'armed', 'skip'])
export const otaFueBien = (ota = {}) => OTA_SIN_FALLO.has(ota.status)

/**
 * Los paquetes OTA que hay en el móvil, tal como los ve el plugin.
 *
 * Es un dato para diagnosticar y por eso va crudo: versión, estado y nada más.
 * Un paquete en **`error`** es el plugin **devolviéndolo** —hace rollback si el
 * nuevo no llama a `notifyAppReady()` a tiempo—, y visto desde fuera eso es
 * idéntico a «no se ha descargado»: el release publicado, el zip con sus
 * descargas, y la pantalla con el número de siempre.
 *
 * Se toca para copiarlo, como el informe de sincronización (§14.9-bis): esto se
 * lee para contarlo en otro sitio, no para arreglarlo aquí.
 */
function ListaDePaquetes({ paquetes }) {
  const [aviso, setAviso] = useState(null)
  if (!paquetes) return null

  const linea = (b) => `v${b.version} · ${b.estado}`
  const informe = [
    `actual: ${paquetes.actual ? linea(paquetes.actual) : 'ninguno'}`,
    `binario: v${paquetes.nativa || '?'}`,
    ...(paquetes.bundles || []).map((b) => `bajado: ${linea(b)}`),
    paquetes.error ? `error: ${paquetes.error}` : '',
  ].filter(Boolean).join('\n')

  async function copiar() {
    tap()
    try {
      await navigator.clipboard.writeText(informe)
      setAviso('Copiado')
    } catch {
      setAviso('No se ha podido copiar')
    }
  }

  return (
    <>
      <div className="pista">Paquetes en este móvil (tócalo para copiarlo):</div>
      <pre
        className={`traza${paquetes.error || (paquetes.bundles || []).some((b) => b.estado === 'error') ? ' mal' : ' bien'}`}
        onClick={copiar}
      >{informe}</pre>
      {aviso && <div className="note" role="status">{aviso}</div>}
    </>
  )
}

/**
 * Aspecto: el tamaño del texto primero y el tema después.
 *
 * Ese orden y no el contrario. El tamaño es el ajuste que arregla un problema
 * —no se lee— y el tema es el que se viene a curiosear; el que arregla algo va
 * antes que el que entretiene.
 */
function AspectoSection() {
  const { tema, elegir: elegirTema } = useTema()
  const { tamano, elegir } = useTamano()

  return (
    <>
      <label>Tamaño del texto</label>
      {/* Segmentado y no desplegable: es lo único de esta pantalla cuyo efecto se
          ve en el sitio, y una rueda de iOS encima taparía justo lo que hay que
          mirar para decidir. */}
      <div className="seg" role="group" aria-label="Tamaño del texto">
        {TAMANOS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tamano === t.id} onClick={() => { tap(); elegir(t.id) }}>
            {t.name}
          </button>
        ))}
      </div>

      <label>Claro u oscuro</label>
      <div className="seg" role="group" aria-label="Claro u oscuro">
        {TEMAS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tema === t.id} onClick={() => { tap(); elegirTema(t.id) }}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="note">Las dos cosas se guardan <b>en este móvil</b> y mueven la app entera, no solo esta pantalla. «Automático» sigue al claro/oscuro del sistema.</div>
    </>
  )
}

/* Aquí vivieron `Cara`, `AVATARES`, `ESTADOS` y `QuienEresSection`, que ahora
   son el botón de tu emoji en la cabecera (`components/BotonDePerfil.jsx`,
   SPECS §14.62). El apartado nació de una pregunta que ya no existe —«¿quién
   eres en este móvil?», que desde §14.42 contesta la cuenta—, y lo que quedaba
   dentro era tu perfil: no un ajuste, sino algo tuyo que se toca a menudo y que
   estaba a tres toques detrás de una rueda. */

/** El evento en curso, y la lista para saltar a otro sin pasar por la portada. */
function EventoSection({ event, onPickEvent }) {
  const events = useLiveQuery(listEvents, [], [])
  const [editando, setEditando] = useState(false)
  // El evento lo edita quien administra (SPECS §14.43): sus fechas mueven las
  // cenas y los planes de todo el grupo —lo que cae fuera se aparta (§14.10-quater)—,
  // así que no es una corrección personal. Sin sesión —libreta local,
  // demostración— no se capa: ahí el evento es de quien tiene el móvil.
  const sesion = leerSesion()
  const puedeEditar = !sesion || esAdministrador(sesion)

  const ficha = (
    <>
      <span className="ico"><Icono nombre="evento" /></span>
      <span className="main">
        <span className="n">{event?.name || 'Evento'}</span>
        <span className="sub">{[event?.lugar, fechasEnPalabras(event)].filter(Boolean).join(' · ') || 'Ballena Ops'}</span>
      </span>
    </>
  )

  return (
    <>
      {/* El de en curso se toca y se edita, como una familia en El grupo
          (§14.14 · E1 + F2): era la única ficha de Ajustes que se miraba sin
          poder corregirla, y las fechas del viaje cambian más que ninguna otra
          cosa del evento. */}
      <div className="card tight">
        <div className="row">
          {puedeEditar ? (
            <button type="button" className="row-quien" onClick={() => { tap(); setEditando(true) }}>
              {ficha}
            </button>
          ) : (
            <span className="row-quien">{ficha}</span>
          )}
          <span className="pill neutral">en curso</span>
        </div>
      </div>

      {!puedeEditar && (
        <div className="note">
          🐳 El viaje —su nombre, el sitio y las fechas— lo lleva quien administra el grupo. Cambiar
          las fechas aparta cenas y planes de todos, y por eso no es cosa de un móvil.
        </div>
      )}

      {editando && event && <EditorEvento event={event} onCerrar={() => setEditando(false)} />}

      {events.filter((e) => e.id !== event?.id).length > 0 && (
        <>
          <div className="sec-h">Cambiar a</div>
          <div className="lista-personas">
            {events.filter((e) => e.id !== event?.id).map((e) => (
              <button
                key={e.id}
                className="persona-opcion btn ghost"
                onClick={() => { tap(); onPickEvent?.(e.id) }}
              >
                <span className="ico pe"><Icono nombre="evento" /></span>
                <span>{e.name}{e.lugar ? ` · ${e.lugar}` : ''}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn ghost block" onClick={() => { tap(); onPickEvent?.(null) }}>↔ Ver todos los eventos</button>
    </>
  )
}

/** «8 – 15 de agosto», para la segunda línea de la ficha del evento. */
function fechasEnPalabras(event) {
  if (!event?.startDate) return ''
  const dia = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  if (!event.endDate || event.endDate === event.startDate) return dia(event.startDate)
  return `${dia(event.startDate)} – ${dia(event.endDate)}`
}

/**
 * Editar el evento en curso, con la misma figura que El grupo: una hoja que
 * sube desde abajo, guardar arriba y el aviso de lo que se lleva por delante.
 *
 * Aquí el aviso no es por borrar, es por **acortar**: una cena o un plan viven
 * en un día concreto, y si ese día deja de existir se quedan fuera del
 * calendario pero dentro de las estadísticas. Se dicen y se borran al confirmar.
 * Los gastos se cuentan y **no se tocan** — la compra grande es del día antes de
 * salir, y borrar dinero por mover una fecha cambiaría los saldos de todos.
 */
export function EditorEvento({ event, onCerrar }) {
  const [name, setName] = useState(event.name ?? '')
  const [lugar, setLugar] = useState(event.lugar ?? '')
  const [cocina, setCocina] = useState(event.cocina ?? '')
  const [startDate, setStart] = useState(event.startDate ?? '')
  const [endDate, setEnd] = useState(event.endDate ?? '')
  const [fuera, setFuera] = useState(null)

  const dinners = useLiveQuery(() => dinnersOf(event.id), [event.id], [])
  const plans = useLiveQuery(() => plansOf(event.id), [event.id], [])
  const expenses = useLiveQuery(() => expensesOf(event.id), [event.id], [])

  const guardar = async () => {
    if (!name.trim()) return
    const fechas = { startDate, endDate }
    const cae = loQueSeCaeFuera(fechas, { dinners, plans, expenses })
    // Primero se avisa; el guardado de verdad va en `confirmar`.
    if ((cae.cenas.length || cae.planes.length) && !fuera) { setFuera(cae); return }
    await confirmar(cae)
  }

  const confirmar = async (cae) => {
    for (const c of cae.cenas) await removeDinner(c.id)
    for (const p of cae.planes) await removePlan(p.id)
    await updateEvent(event.id, {
      name: name.trim(), lugar: lugar.trim(), cocina: cocina.trim(), startDate, endDate,
    })
    onCerrar()
  }

  const gastosFuera = loQueSeCaeFuera({ startDate, endDate }, { expenses }).gastos.length

  return (
    <Hoja titulo="Editar evento" onCerrar={onCerrar}>
      <label htmlFor="ev-nombre">Nombre</label>
      <input id="ev-nombre" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ballenita 2026" autoFocus />
      <label htmlFor="ev-lugar">Lugar</label>
      <input id="ev-lugar" type="text" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Camping La Ballena Alegre" />

      {/* Qué se puede cocinar, para la IA y **solo** para la IA (§14.20-quater).
          Texto libre y no una lista de casillas: lo que hay que contarle es la
          frase entera —«en el bungaló se puede hacer algo en sartén, pero poco:
          da mucho calor»—, y eso ninguna casilla lo dice. */}
      <label htmlFor="ev-cocina">Qué se puede cocinar</label>
      {/* Seis renglones y no tres: el texto en gris es lo que se va a mandar, y
          medido en el navegador ocupa seis líneas a 390 pt. En tres se cortaba a
          media palabra —«En el bungaló se pue…»—, que es no enseñarlo. */}
      <textarea
        id="ev-cocina"
        rows={6}
        value={cocina}
        onChange={(e) => setCocina(e.target.value)}
        placeholder={COCINA_DE_ORIGEN}
      />
      <div className="pista">
        Solo lo lee la IA, para que lo que proponga se pueda cocinar. Vacío va lo
        que pone en gris.
      </div>
      {/* Una bajo la otra y no en dos columnas: el control de fecha nativo mide
          más que media pantalla y sacaba la hoja de lado en un móvil de verdad. */}
      <label htmlFor="ev-desde">Desde</label>
      <input
        id="ev-desde" type="date" value={startDate}
        onChange={(e) => { setStart(e.target.value); setEnd(finPara(e.target.value, endDate)); setFuera(null) }}
      />
      <label htmlFor="ev-hasta">Hasta</label>
      {/* `min` es la mitad de la regla: el fin se propone solo al elegir el
          inicio, y aquí el propio campo impide dejarlo antes. */}
      <input
        id="ev-hasta" type="date" value={endDate} min={startDate || undefined}
        onChange={(e) => { setEnd(e.target.value); setFuera(null) }}
      />

      {gastosFuera > 0 && (
        <div className="note">
          🐳 {gastosFuera === 1 ? 'Hay 1 gasto' : `Hay ${gastosFuera} gastos`} con fecha fuera del viaje.
          No se tocan: siguen contando en los saldos.
        </div>
      )}

      <div className="editor-pie">
        <button className="btn ghost" onClick={onCerrar}>Cancelar</button>
        <button className="btn" onClick={guardar}>Guardar</button>
      </div>

      {fuera && (
        <div className="confirmar">
          <div className="que-se-lleva">
            Con esas fechas se quedan fuera <b>{enPalabras(fuera)}</b>, y se borran al guardar.
          </div>
          <div className="grid2">
            <button className="btn ghost" onClick={() => setFuera(null)}>Dejarlo</button>
            <button className="btn danger" onClick={() => confirmar(fuera)}>Guardar y borrar</button>
          </div>
        </div>
      )}
    </Hoja>
  )
}

/**
 * Sesión y, para quien administre el grupo, el alta de gente nueva.
 *
 * La incorporación es por invitación: alguien que ya está dentro pega aquí el
 * código que le ha pasado el aspirante. Sin esto haría falta entrar en la base
 * de datos a mano para dejar entrar a nadie.
 */
/**
 * Un hecho de la app: el rótulo a la izquierda y el dato a la derecha.
 *
 * `sub` es la segunda línea, y solo sale cuando hace falta —qué migraciones
 * faltan, que la sincronización no va bien—: un renglón que dice «Al día» no
 * necesita explicarse.
 */
function Hecho({ titulo, valor, sub }) {
  return (
    <div className="hecho">
      <dt>{titulo}</dt>
      <dd>
        {valor}
        {sub ? <span className="sub">{sub}</span> : null}
      </dd>
    </div>
  )
}

/**
 * «La app»: **cuatro hechos y dos botones** (SPECS §14.34-quater).
 *
 * Este apartado era tres bloques con sus tres rótulos, tres estados, tres
 * botones y tres listas de progreso —los datos del grupo, la versión, la base de
 * datos—, y contaba cada cosa en prosa: «Versión en curso: v0.50.0. Paquete
 * puesto: v0.49.0», «Un toque sube lo pendiente, trae la última copia…». Lo que
 * se viene a mirar aquí son cuatro números y un sí o un no, y estaban repartidos
 * entre seis párrafos.
 *
 * Ahora son una ficha de cuatro renglones —**binario · paquete OTA · última
 * sincronización · base de datos**— y debajo los dos botones que hacen algo:
 * **poner la app al día** y **poner la base al día**. Cada renglón se lee de un
 * vistazo y cada botón dice qué mueve.
 *
 * **El botón de sincronizar se retira**, que era el tercero. Hacía exactamente
 * lo mismo que el punto de la cabecera —datos y versión en una pasada, §14.10—,
 * y ese está en todas las pantallas y con su propia lista de progreso; aquí
 * quedaba el renglón que dice **cuándo fue la última**, que es lo que se viene a
 * mirar. Lo que sí se queda son los dos avisos que no son estado sino salida:
 * «estás sin entrar» con su botón, y «aquí es solo local».
 *
 * **La lista de paquetes se guarda para cuando falla** (§14.37). Es un volcado
 * crudo del plugin y estaba siempre puesta; ahora sale detrás de una respuesta
 * que **no** fue bien, que es el caso para el que se escribió: «se descarga y no
 * se queda». Su dato útil —la versión del binario— sube al primer renglón.
 */
function AppSection({ sync, esAdmin = false }) {
  // null = en reposo · si no, la clave del paso actual (UPDATE_STEPS).
  const [paso, setPaso] = useState(null)
  const busy = paso !== null
  // Si venimos de recargar por una actualización, enseñamos el ✓ y limpiamos la marca.
  const [recienActualizada] = useState(veniaDeActualizar)
  // Cuando la búsqueda acaba, el modal se queda unos segundos con su «Ok»: la
  // recarga se lo llevaba por delante en cuanto terminaba, y lo único que se
  // veía era la pantalla parpadeando sin decir en qué había quedado.
  const [terminado, setTerminado] = useState(false)
  // Lo que contestó el paquete OTA cuando no fue «actualizado». Se enseña en vez
  // de tirarse: «no ha actualizado» sin motivo no se puede arreglar desde aquí.
  // Lleva **si fue bien**, que es lo que decide el color: tres de los cinco
  // desenlaces son normales y salían en rojo.
  const [respuesta, setRespuesta] = useState(null)
  // La versión del **paquete que se está ejecutando**, que dentro de la app es la
  // que cuenta: la de `package.json` es la que se horneó en el binario.
  const [enCurso, setEnCurso] = useState(null)
  // Y lo que el plugin tiene de verdad. De aquí sale la versión del binario, que
  // es el otro número de la ficha, y el volcado para cuando algo falla.
  const [paquetes, setPaquetes] = useState(null)
  useEffect(() => {
    versionInstalada().then(setEnCurso).catch(() => {})
    estadoDelPaquete().then(setPaquetes).catch(() => {})
  }, [])
  const caja = useRef(null)
  useEffect(() => {
    if (!recienActualizada) return
    limpiarMarcaActualizacion()
    // El apartado se reabre solo (Acordeon recuerda su solapa), pero la recarga
    // deja la pantalla arriba del todo: sin esto acabas mirando «Aspecto» sin
    // saber si la actualización llegó a pasar.
    caja.current?.scrollIntoView({ block: 'center' })
  }, [recienActualizada])

  // --- La sincronización, que aquí es un dato y ya no un botón ---------------
  //
  // La configuración se lee en caliente de config.json, así que llega después
  // del primer pintado en vez de estar horneada en el bundle.
  const [detectada, setDetectada] = useState(false)
  useEffect(() => {
    if (sync) return undefined
    let vivo = true
    hayApi().then((si) => { if (vivo) setDetectada(si) })
    return () => { vivo = false }
  }, [sync])
  const estado = sync ?? { isConfigured: detectada, online: true, status: 'idle' }
  const d = estadoSync(estado)
  const ultima = estado.ultima ?? null
  // Hay grupo al otro lado, pero este móvil eligió seguir sin entrar.
  const enLocal = estado.isConfigured && modoLocal() && !leerSesion()

  // La puerta se vuelve a abrir recargando: App decide qué pintar al arrancar y
  // así no hay dos sitios que recuerden si se entró o no.
  function volverAIntentarlo() {
    tap()
    salirDeModoLocal()
    window.location.reload()
  }

  // --- La base de datos ------------------------------------------------------
  //
  // Las migraciones siguen sin lanzarse solas (SPECS §14.23), pero ya no exigen
  // un portátil: si administras y la base va por detrás del código, el renglón
  // lo dice y el botón las aplica **una a una**, contando el progreso debajo. El
  // SQL no viaja desde el móvil: vive dentro del Worker, y de aquí solo sale
  // «aplica la siguiente».
  //
  // null = todavía no se sabe. `errorBd` es por qué no se sabe: la consulta se
  // tragaba su error y el bloque no aparecía, y desde el móvil «la base está al
  // día» y «no he podido preguntarlo» se ven exactamente igual (§14.37-bis).
  const [pendientes, setPendientes] = useState(null)
  const [pasosBd, setPasosBd] = useState(null)
  const [ocupadoBd, setOcupadoBd] = useState(false)
  const [errorBd, setErrorBd] = useState(null)
  useEffect(() => {
    if (!esAdmin) return undefined
    let vivo = true
    leerMigraciones()
      .then((r) => { if (vivo) setPendientes(r.migraciones.filter((m) => m.pendiente).map((m) => m.id)) })
      .catch((e) => { if (vivo) setErrorBd(String(e.message ?? e)) })
    return () => { vivo = false }
  }, [esAdmin])

  async function ponerLaBaseAlDia() {
    if (ocupadoBd || !pendientes?.length) return
    tap()
    setOcupadoBd(true)
    const lista = pendientes.map((id) => ({ texto: id, estado: 'pendiente' }))
    const pinta = () => setPasosBd([...lista])
    pinta()

    for (let i = 0; i < lista.length; i += 1) {
      lista[i].estado = 'curso'
      pinta()
      try {
        const r = await aplicarSiguienteMigracion()
        lista[i].estado = 'hecho'
        // Media migración ya estaba (aplicada a mano, a medias): se dice, no se
        // esconde — un «✓» que ejecutó cero cosas se leería como que las hizo.
        if (r.aplicada?.saltadas) lista[i].texto = `${lista[i].texto} · ${r.aplicada.saltadas} ya estaban`
      } catch (e) {
        // El fallo con su estado HTTP, y el renglón se toca para copiarlo
        // (§14.9-bis): un error de SQL no se transcribe a mano desde un móvil.
        lista[i].estado = 'fallo'
        lista[i].informe = String(e.message ?? e)
        pinta()
        setOcupadoBd(false)
        return
      }
      pinta()
    }
    setPendientes([])
    setOcupadoBd(false)
  }

  /** El renglón de la base: los cinco estados, cada uno con su palabra. */
  const laBase = () => {
    if (!esAdmin) return { valor: 'No te toca', sub: 'La pone al día quien administra.' }
    if (errorBd) return { valor: 'No se ha podido preguntar', sub: errorBd }
    if (pendientes === null) return { valor: 'Preguntando…' }
    if (!pendientes.length) return { valor: 'Al día' }
    return {
      valor: pendientes.length === 1 ? '1 por detrás' : `${pendientes.length} por detrás`,
      sub: pendientes.join(', '),
    }
  }

  async function actualizar() {
    if (busy) return
    tap()
    marcarPostActualizacion() // al re-arrancar, la app vuelve aquí en vez de a Hoy
    setTerminado(false)
    setRespuesta(null)
    setPaso('checking') // empieza a contar ya, sin esperar al primer aviso
    const inicio = Date.now()

    // En la app de iOS la versión nueva **no** llega por el service worker: llega
    // en un paquete OTA que hasta ahora solo se miraba al arrancar. Un botón que
    // se llama «Forzar la última versión» y no lo miraba dejaba al teléfono en la
    // de antes por mucho que se tocara.
    if (isNative()) {
      setPaso('downloading')
      const ota = await checkForOtaUpdate({ aplicarYa: true })
      // Si se aplicó, la webview ya se está recargando con el paquete nuevo.
      if (ota.status === 'updated') return
      // Y si no, **se dice por qué** (§14.9-bis). Antes esta respuesta se tiraba:
      // el botón seguía con el camino del service worker —que dentro de la app
      // de iOS no trae nada— y terminaba con su ✓. La pantalla decía que había
      // actualizado y el teléfono se quedaba en la de antes, sin nada que mirar.
      setPaso(null)
      setRespuesta({ texto: motivoDelOta(ota), bien: otaFueBien(ota) })
      return
    }

    forzarActualizacion(setPaso, {
      // La recarga es inevitable (hay que cargar el JS nuevo), pero la retrasamos
      // un poco para que el progreso se vea de verdad y no sea un parpadeo.
      reload: async () => {
        const resto = 1200 - (Date.now() - inicio)
        if (resto > 0) await new Promise((r) => setTimeout(r, resto))
        setTerminado(true)
        await new Promise((r) => setTimeout(r, ESPERA_FINAL))
        window.location.reload()
      },
    })
  }

  const base = laBase()

  return (
    <div ref={caja}>
      {/* Los cuatro hechos, en una ficha y sin prosa. Dentro de la app hay dos
          números y no siempre coinciden —el que se horneó en el binario y el del
          paquete OTA puesto encima—, y esa diferencia es justo la que separa «no
          ha actualizado» de «se ha quedado atrás el binario». Antes iban en una
          frase, y solo cuando no coincidían. */}
      <dl className="hechos" aria-label="Cómo está la app">
        {isNative() ? (
          <>
            <Hecho titulo="Binario" valor={paquetes?.nativa ? `v${paquetes.nativa}` : '—'} />
            <Hecho
              titulo="Paquete OTA"
              valor={enCurso && enCurso !== 'builtin' ? `v${enCurso}` : 'Ninguno'}
              sub={recienActualizada ? 'Recién actualizada ✓' : null}
            />
          </>
        ) : (
          <Hecho
            titulo="Versión"
            valor={`v${APP_VERSION}`}
            // En la web no hay binario ni paquete: la versión es la que sirve el
            // servidor, y se pone al día recargando.
            sub={recienActualizada ? 'Recién actualizada ✓' : 'En la web no hay paquete OTA.'}
          />
        )}
        <Hecho
          titulo="Última sincronización"
          valor={ultima ? formatearHace(ultima) : 'Todavía ninguna'}
          // El estado solo cuando **no** es «Al día»: si algo va mal, el renglón
          // que dice cuándo fue la última buena se lee como que todo va bien.
          sub={d.title === 'Al día' ? null : d.title}
        />
        <Hecho titulo="Base de datos" valor={base.valor} sub={base.sub} />
      </dl>

      {/* Y los dos botones, uno por cosa. El de la base sale siempre para quien
          administra —y apagado cuando no hay nada que aplicar—: aparecer solo a
          veces obliga a saber de antemano si iba a estar, y este apartado se
          abre justo para buscarlo. */}
      <button className="btn ghost block" disabled={busy} onClick={actualizar}>
        {busy ? 'Comprobando…' : 'Poner la app al día'}
      </button>

      {busy && (
        <>
          <ListaDePasos
            pasos={PASOS_APP.map((p, i) => ({
              texto: UPDATE_STEPS[p],
              estado: terminado || i < PASOS_APP.indexOf(paso) ? 'hecho'
                : i === PASOS_APP.indexOf(paso) ? 'curso' : 'pendiente',
            }))}
          />
          <div className="pista">
            {terminado
              ? `Se recarga sola en ${ESPERA_FINAL / 1000} segundos y volverás aquí, a Ajustes.`
              : 'No cierres la app: se recarga sola al terminar y volverás aquí, a Ajustes.'}
          </div>
        </>
      )}

      {respuesta && (
        <pre className={`traza ${respuesta.bien ? 'bien' : 'mal'}`} role="status">{respuesta.texto}</pre>
      )}

      {/* Los paquetes que hay bajados y en qué estado, **solo cuando la
          actualización no ha ido bien** (§14.37). Un paquete en `error` es el
          plugin devolviéndolo —hace rollback si el nuevo no llama a
          `notifyAppReady()` a tiempo—, y eso desde fuera se ve igual que «no se
          ha bajado». Es lo único que hay para distinguirlos, y no hace falta
          verlo el resto del tiempo. */}
      {respuesta && !respuesta.bien && paquetes && <ListaDePaquetes paquetes={paquetes} />}

      {esAdmin && (
        <button
          className="btn ghost block"
          disabled={ocupadoBd || !pendientes?.length}
          onClick={ponerLaBaseAlDia}
        >
          {ocupadoBd ? 'Aplicando…' : 'Poner la base al día'}
        </button>
      )}
      {pasosBd && <ListaDePasos pasos={pasosBd} />}

      {/* Y las dos salidas, que no son estado sino qué hacer al respecto. */}
      {enLocal && (
        <>
          <div className="note">
            Estás usando Ballena Ops <b>sin entrar</b>: lo que apuntas se queda en este móvil,
            encolado. En cuanto consigas entrar con Apple sube todo de una vez —no hay que
            volver a teclear nada—.
          </div>
          <button className="btn sm" onClick={volverAIntentarlo}>
            Probar a entrar con Apple
          </button>
        </>
      )}
      {!enLocal && !estado.isConfigured && (
        <div className="note">
          Aquí Ballena Ops es <b>solo local</b>: todo funciona igual, pero se queda en este
          dispositivo. Compartir gastos con el grupo requiere la <b>app de iOS</b>, que es
          donde vive el acceso con Apple.
        </div>
      )}
    </div>
  )
}

/**
 * «Qué ha cambiado»: una tarjeta por versión y de lado (SPECS §14.34, la figura
 * de `meeting-ops-air`), la que llevas puesta y las tres de antes. La prosa vive
 * en `lib/notas.js`, escrita a mano en cada vuelta y atada a la versión por su
 * test — así Ajustes contesta «¿qué me trajo la actualización?» y no solo
 * «¿cuál tengo puesta?».
 *
 * **Apartado propio, y no el final de «La app»** (§14.34-ter). Dentro de «La
 * app» era el tercer bloque de un acordeón que ya contaba dos operaciones —poner
 * la app al día y poner la base al día—, así que para leer lo que trajo la
 * actualización había que pasar por encima de los dos botones que la hacen. Son
 * dos preguntas distintas y se contestan de distinta manera: «¿estoy al día?» se
 * toca, «¿qué me ha traído?» se lee. §14.34-bis lo sacó de en medio del botón de
 * actualizar y lo dejó al final del mismo apartado, que era la mitad del camino.
 */
function NovedadesSection() {
  return (
    <div className="relnotas" aria-label="Qué cambió, por versión">
      {NOTAS.slice(0, 4).map((n) => (
        <div className="relnota" key={n.version}>
          <div className="rn-meta tnum">v{n.version} · {n.fecha}</div>
          <div className="rn-titulo">{n.titulo}</div>
          {n.lineas.map((l, i) => <p className="rn-linea" key={i}>{l}</p>)}
        </div>
      ))}
    </div>
  )
}

/**
 * Ajustes, en apartados plegables.
 *
 * La figura es la de `garciadoral-ops`: `<details>`/`<summary>` del navegador,
 * y **todos plegados**. Ajustes es una lista de cosas que casi nunca se tocan;
 * dejar una abierta obliga a pasarle por encima para llegar a las demás. Con las
 * diez plegadas la pantalla entera se lee de un vistazo y se toca la que se venía
 * a buscar: un gesto en vez de un desplazamiento. Cada rótulo lleva su nota
 * —«v0.2.0», «6», el tema puesto—, así que plegado no quiere decir mudo.
 *
 * Se ha comido lo que antes era «Más»: las estadísticas eran media pestaña de la
 * barra inferior para algo que se mira al volver del viaje, y ahora son un
 * apartado como los demás.
 */
export default function EventSettingsScreen({ eventId, event, onPickEvent, sync }) {
  const families = useLiveQuery(() => familiesOf(eventId), [eventId], [])
  const persons = useLiveQuery(() => personsOf(eventId), [eventId], [])
  const { me } = useIdentidad(eventId, persons)
  // Las mejoras se leen aquí y no dentro del apartado: el rótulo lleva las que
  // faltan, y una mejora se marca sin cerrar la solapa — el número tiene que
  // moverse con ella (figura de garciadoral-ops, `docs/diseño/mejoras.html` · A1).
  const mejoras = useLiveQuery(() => listMejoras(event), [event?.id, event?.esDemo], [])
  const mejorasQueFaltan = mejoras.filter((m) => !m.hecho).length
  // Las cuentas y sus avisos: los pinta «Notificaciones» y los cuenta el rótulo.
  const { esAdmin, cuentas } = useCuentas()
  const pendientes = avisosPara({ cuentas: cuentas ?? [], esAdmin }).length
  const { tema: temaPuesto } = useTema()
  const sesion = leerSesion()

  return (
    <div className="body">
      {/* El orden es el de lo que se toca, no el del cableado: primero lo del
          viaje —cómo se ve, qué evento es, quién viene y quién eres tú— y al
          final la fontanería, que se abre cuando algo falla. */}
      <Acordeon titulo="Aspecto" icono="aspecto" nota={TEMAS.find((t) => t.id === temaPuesto)?.name}>
        <AspectoSection />
      </Acordeon>

      <Acordeon titulo="Evento" icono="evento" nota={event?.name}>
        <EventoSection event={event} onPickEvent={onPickEvent} />
      </Acordeon>

      {/* Aquí estuvo el rastro de «El grupo», que se mudó a su pestaña en
          §14.52: un renglón que decía a dónde había ido. Se retira (§14.65).
          Un cartel de mudanza sirve las primeras veces y estorba el resto: el
          grupo lleva su pestaña en la barra, que es donde se busca, y quien
          abre Ajustes ya no viene a por él. */}

      <Acordeon titulo="Notificaciones" icono="aviso" nota={pendientes || null}>
        <NotificacionesSection />
      </Acordeon>

      {sesion && (
        <Acordeon titulo="Cuentas" icono="llave" nota={cuentas ? cuentas.length : null}>
          {/* `sincronizar` es lo que deja subir la cola antes de borrarla al
              salir (§14.9-ter): sin él, salir con cambios sin subir los perdía. */}
          <CuentasSection eventId={eventId} sincronizar={sync?.recheck} />
        </Acordeon>
      )}

      {esAdmin && (
        <Acordeon titulo="IA" icono="ballena">
          <IASection />
        </Acordeon>
      )}

      {/* Penúltimo y pegado a «La app» a propósito: las dos hablan de la
          app, no del viaje, y una mejora se apunta menos veces que todo lo
          demás (`docs/diseño/mejoras.html` · A1). */}
      <Acordeon titulo="Mejoras" icono="mejora" nota={mejorasQueFaltan ? `${mejorasQueFaltan} sin hacer` : null}>
        <MejorasSection
          evento={event}
          mejoras={mejoras}
          persons={persons}
          families={families}
          meId={me?.id ?? null}
        />
      </Acordeon>

      {/* «Sincronización» y «Actualizar» eran dos acordeones contando la misma
          operación por mitades — el punto de la cabecera ya hace las dos cosas
          en una pasada (datos + versión, §14.10)—, así que aquí van juntas y el
          apartado se llama por lo que es: la app (SPECS §14.41). */}
      <Acordeon titulo="La app" icono="sincronizar" nota={`v${APP_VERSION}`}>
        <AppSection sync={sync} esAdmin={esAdmin} />
      </Acordeon>

      {/* Y detrás, en su propio apartado, lo que trajo cada versión (§14.34-ter).
          Detrás y no delante: se lee **después** de actualizar.

          **Sin nota en la solapa**, y es lo único de este apartado que se probó
          y se cayó: el titular de la última versión pide 370 pt y en el renglón
          quedan 174,8, así que salía por la mitad y encima empujaba el rótulo a
          dos líneas (48 → 73,2 pt de alto). Y «v0.50.0» ya lo dice la solapa de
          justo encima. El rótulo solo se basta.

          El icono es el de «hecho» y no la bombilla, que es la de «Mejoras»
          —dos solapas con el mismo dibujo en la misma pantalla—: puestas cerca
          se leen como el par que son, lo que falta y lo que ya está. */}
      <Acordeon titulo="Qué ha cambiado" icono="visto">
        <NovedadesSection />
      </Acordeon>

    </div>
  )
}
