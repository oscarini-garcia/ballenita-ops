import { useEffect, useState } from 'react'
import { exportSnapshot, importSnapshot } from '../db.js'
import { mergeSnapshots, differs } from './merge-snapshot.js'
import * as remote from './jsonbin.js'

// "Sucio" = hay cambios locales sin subir. Se marca con cada mutación (§14, assessment #1:
// no hacemos PUT en vano).
let dirty = false
if (typeof window !== 'undefined') {
  window.addEventListener('ballena:changed', () => { dirty = true })
}

let syncing = false

// Un ciclo de sincronización: pull → merge → aplica en local → push (solo si hace falta).
export async function syncNow() {
  if (!remote.isConfigured()) return { status: 'no-config' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' }
  if (syncing) return { status: 'busy' }
  syncing = true
  try {
    const local = await exportSnapshot()
    let pulled = null
    try { pulled = await remote.pull() } catch { pulled = null }
    const remoteSnap = pulled?.tables ? pulled : { v: 1, tables: {}, tombstones: [] }
    const remoteEmpty = !pulled?.tables

    const merged = mergeSnapshots(local, remoteSnap)
    await importSnapshot(merged)

    if (dirty || remoteEmpty || differs(merged, remoteSnap)) {
      await remote.push(merged)
      dirty = false
    }
    return { status: 'synced', at: Date.now() }
  } catch (e) {
    return { status: 'error', error: String(e?.message ?? e) }
  } finally {
    syncing = false
  }
}

// Hook que orquesta la sync: al montar, al volver online, al volver a foreground,
// tras un cambio (con debounce) y cada 90 s con la app visible. Sin background sync
// real en iOS — este patrón es el de counter-ops (§14.3).
//
// Además expone lo que necesita el indicador de la cabecera (§ barra superior):
//   · `online`  → hay conexión de red (rojo si no).
//   · `dirty`   → hay cambios locales encolados sin subir (amarillo).
//   · `recheck` → fuerza recomprobar red + sincronizar (al tocar el punto).
export function useSyncEngine() {
  const [state, setState] = useState({ status: remote.isConfigured() ? 'idle' : 'no-config' })
  const [dirty, setDirty] = useState(false)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  )

  // Estado de red y cola local: se siguen aunque no haya sync configurada, para
  // que el punto de la cabecera reaccione igual (rojo sin red).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onNet = () => setOnline(navigator.onLine !== false)
    const onChangedDirty = () => setDirty(true)
    window.addEventListener('online', onNet)
    window.addEventListener('offline', onNet)
    window.addEventListener('ballena:changed', onChangedDirty)
    return () => {
      window.removeEventListener('online', onNet)
      window.removeEventListener('offline', onNet)
      window.removeEventListener('ballena:changed', onChangedDirty)
    }
  }, [])

  useEffect(() => {
    if (!remote.isConfigured()) return
    let alive = true
    let debounce
    const go = async () => {
      setState((s) => ({ ...s, status: 'syncing' }))
      const r = await syncNow()
      if (!alive) return
      setState(r)
      if (r.status === 'synced') setDirty(false)
    }
    go()
    const onOnline = () => go()
    const onVisible = () => { if (document.visibilityState === 'visible') go() }
    const onChanged = () => { clearTimeout(debounce); debounce = setTimeout(go, 1500) }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('ballena:changed', onChanged)
    const iv = setInterval(() => { if (document.visibilityState === 'visible') go() }, 90 * 1000)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('ballena:changed', onChanged)
      clearInterval(iv); clearTimeout(debounce)
    }
  }, [])

  // Recheck manual (al tocar el punto de la cabecera): revalida la red y fuerza
  // un ciclo de sincronización.
  const recheck = async () => {
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine !== false)
    if (!remote.isConfigured()) return { status: 'no-config' }
    setState((s) => ({ ...s, status: 'syncing' }))
    const r = await syncNow()
    setState(r)
    if (r.status === 'synced') setDirty(false)
    return r
  }

  return { ...state, dirty, online, isConfigured: remote.isConfigured(), sync: syncNow, recheck }
}
