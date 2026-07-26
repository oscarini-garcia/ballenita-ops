/**
 * El orquestador de la sincronización: decide **cuándo** se sincroniza.
 *
 * El qué y el cómo están en `api.js` (el transporte) y en `db.js` (la cola);
 * aquí solo vive el calendario y el candado. Se sincroniza al abrir, al volver la
 * red, al volver la app a primer plano y cada 90 segundos, porque Safari en iOS
 * no tiene sincronización en segundo plano: si la app no está delante, no corre
 * nada, y ese es el motivo de que el patrón sea este y no un service worker.
 *
 * El candado (`syncing`) no es una precaución de manual: dos ciclos a la vez
 * subirían la misma cola dos veces y el segundo aplicaría una instantánea vieja
 * encima de la nueva.
 */
import { useEffect, useState } from 'react'
import { colaPendiente, importSnapshot, vaciarCola, db } from '../db.js'
import { haySesion } from '../auth/sesion.js'
import * as api from './api.js'

let syncing = false

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
      rechazados = (respuesta.resultados ?? []).filter((r) => !r.aplicado)
      if (rechazados.length) console.warn('Cambios no aplicados por el servidor:', rechazados)
    } else {
      instantanea = await api.traerInstantanea()
    }

    if (corte) await vaciarCola(corte)
    if (instantanea?.tables) await importSnapshot(instantanea)

    return { status: 'synced', at: Date.now(), rechazados }
  } catch (error) {
    if (error?.sesionCaducada) return { status: 'sesion-caducada' }
    return { status: 'error', error: String(error?.message ?? error) }
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
//   · `recheck` → fuerza recomprobar red + sincronizar (al tocar el punto).
export function useSyncEngine() {
  const [state, setState] = useState({ status: 'idle' })
  const [dirty, setDirty] = useState(false)
  const [isConfigured, setConfigured] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  // La cola es la verdad sobre si queda algo por subir: sobrevive a recargas,
  // así que se consulta en vez de recordarse en memoria.
  useEffect(() => {
    let vivo = true
    const revisar = async () => {
      const pendientes = await db.outbox.count()
      if (vivo) setDirty(pendientes > 0)
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
      setDirty((await db.outbox.count()) > 0)
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
    setDirty((await db.outbox.count()) > 0)
    return r
  }

  return { ...state, dirty, online, isConfigured, sync: syncNow, recheck }
}
