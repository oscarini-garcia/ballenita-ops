// El orquestador de la sincronización: cuándo se sube la cola y se baja la
// instantánea.
//
// Sube la cola de cambios, el servidor la aplica y devuelve la instantánea, que
// **sustituye** a la copia local: el servidor es la autoridad, así que aquí no
// hay merge ni tombstones. Se sincroniza al abrir, al volver la red, al pasar a
// primer plano y cada 90 s — en iOS no hay background sync, así que todo pasa
// en primer plano.
import { useEffect, useState } from 'react'
import { colaPendiente, importSnapshot, vaciarCola, db } from '../db.js'
import { haySesion } from '../auth/sesion.js'
import * as api from './api.js'

let syncing = false

/**
 * Cuándo fue la última vez que se sincronizó **bien**.
 *
 * Se guarda porque es lo primero que se mira cuando algo huele raro, y porque
 * «al día» sin fecha no dice nada: puede llevar cinco minutos o tres días.
 * Sobrevive a recargas, así que va a `localStorage` y no a memoria. Idea de
 * `garciadoral-ops`, donde la línea se lee para tranquilizarse.
 */
const CLAVE_ULTIMA = 'ballena.sync.ultima'

export function ultimaSincronizacion() {
  try {
    const v = Number(localStorage.getItem(CLAVE_ULTIMA))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function apuntarUltima(cuando) {
  try { localStorage.setItem(CLAVE_ULTIMA, String(cuando)) } catch { /* da igual */ }
}

/**
 * Un ciclo de sincronización: sube la cola, aplica lo que devuelve el servidor.
 *
 * El orden importa. La cola se vacía **hasta la marca que se subió**, no del
 * todo: lo que haya entrado mientras la petición estaba en vuelo sigue ahí, y
 * `importSnapshot` lo vuelve a aplicar encima de la instantánea. Vaciarla
 * entera perdería los cambios de esos segundos, que es justo cuando alguien
 * está apuntando gastos a toda prisa.
 */
export async function syncNow() {
  if (!(await api.hayApi())) return { status: 'no-config' }
  if (!haySesion()) return { status: 'sin-sesion' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' }
  if (syncing) return { status: 'busy' }

  syncing = true
  try {
    const cola = await colaPendiente()
    const corte = cola.length ? cola[cola.length - 1].orden : 0

    let instantanea
    let rechazados = []

    if (cola.length) {
      const respuesta = await api.enviarCambios(cola.map(({ orden, ...cambio }) => cambio))
      instantanea = respuesta.instantanea
      // Lo que el servidor no ha aplicado **hay que decirlo**, no solo apuntarlo
      // en una consola que nadie abre desde un iPhone: la interfaz es optimista,
      // así que un cambio rechazado se vio guardado un momento y desaparece con
      // la instantánea siguiente. Sin aviso, eso no se lee como un error sino
      // como que la app pierde cosas. (`garciadoral-ops`.)
      rechazados = (respuesta.resultados ?? []).filter((r) => !r.aplicado)
      // La consola sigue sirviendo desarrollando; lo que no puede es ser el
      // único sitio donde consta.
      if (rechazados.length) console.warn('Cambios no aplicados por el servidor:', rechazados)
    } else {
      instantanea = await api.traerInstantanea()
    }

    if (corte) await vaciarCola(corte)
    if (instantanea?.tables) await importSnapshot(instantanea)

    const at = Date.now()
    apuntarUltima(at)
    return { status: 'synced', at, ultima: at, rechazados }
  } catch (error) {
    if (error?.sesionCaducada) return { status: 'sesion-caducada', ultima: ultimaSincronizacion() }
    return {
      status: 'error',
      // El motivo ya viene compuesto por el transporte, con el estado HTTP
      // delante cuando lo hay (sync/api.js). Aquí no se recorta.
      error: String(error?.message ?? error),
      estado: error?.estado ?? null,
      ultima: ultimaSincronizacion(),
    }
  } finally {
    syncing = false
  }
}

// Hook que orquesta la sync: al montar, al volver online, al volver a foreground,
// tras un cambio (con debounce) y cada 90 s con la app visible. Sin background sync
// real en iOS — este patrón es el de counter-ops (§14.3).
//
// Expone lo que necesita el indicador de la cabecera:
//   · `online`  → hay conexión de red (rojo si no).
//   · `dirty`   → hay cambios en la cola sin subir (amarillo).
//   · `pendientes` → **cuántos**. El número, y no solo el sí/no: sin red la cola
//     crece y «cambios sin subir» dice lo mismo con uno que con veinte. Saber
//     que hay quince es lo que hace esperar a tener cobertura en vez de dar por
//     perdido lo apuntado.
//   · `recheck` → fuerza recomprobar red + sincronizar (al tocar el punto).
export function useSyncEngine() {
  const [state, setState] = useState({ status: 'idle' })
  const [pendientes, setPendientes] = useState(0)
  const [isConfigured, setConfigured] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  // La cola es la verdad sobre si queda algo por subir: sobrevive a recargas,
  // así que se consulta en vez de recordarse en memoria.
  useEffect(() => {
    let vivo = true
    const revisar = async () => {
      const cuantos = await db.outbox.count()
      if (vivo) setPendientes(cuantos)
    }
    revisar()
    if (typeof window === 'undefined') return () => { vivo = false }

    const onNet = () => setOnline(navigator.onLine !== false)
    window.addEventListener('online', onNet)
    window.addEventListener('offline', onNet)
    window.addEventListener('ballena:changed', revisar)
    return () => {
      vivo = false
      window.removeEventListener('online', onNet)
      window.removeEventListener('offline', onNet)
      window.removeEventListener('ballena:changed', revisar)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    let debounce

    const go = async () => {
      setState((s) => ({ ...s, status: 'syncing' }))
      const r = await syncNow()
      if (!vivo) return
      setState(r)
      setConfigured(r.status !== 'no-config')
      setPendientes(await db.outbox.count())
    }

    go()
    if (typeof window === 'undefined') return () => { vivo = false }

    const onOnline = () => go()
    const onVisible = () => { if (document.visibilityState === 'visible') go() }
    const onChanged = () => { clearTimeout(debounce); debounce = setTimeout(go, 1500) }

    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('ballena:changed', onChanged)
    const iv = setInterval(() => { if (document.visibilityState === 'visible') go() }, 90 * 1000)

    return () => {
      vivo = false
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('ballena:changed', onChanged)
      clearInterval(iv)
      clearTimeout(debounce)
    }
  }, [])

  const recheck = async () => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine !== false)
    setState((s) => ({ ...s, status: 'syncing' }))
    const r = await syncNow()
    setState(r)
    setConfigured(r.status !== 'no-config')
    setPendientes(await db.outbox.count())
    return r
  }

  return {
    ...state,
    pendientes,
    dirty: pendientes > 0,
    online,
    isConfigured,
    ultima: state.ultima ?? ultimaSincronizacion(),
    rechazados: state.rechazados ?? [],
    sync: syncNow,
    recheck,
  }
}
