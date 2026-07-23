import { mergeCollection } from '../lib/merge.js'
import { SYNC_TABLES } from './tables.js'

// Une dos snapshots completos (local y remoto) tabla a tabla, con LWW + tombstones.
// Los tombstones se guardan como { key, table, rowId, ts }; se unen quedándonos
// con el ts más reciente por key.
export function mergeSnapshots(local, remote) {
  const tmap = new Map()
  for (const t of [...(local?.tombstones ?? []), ...(remote?.tombstones ?? [])]) {
    const prev = tmap.get(t.key)
    if (!prev || (t.ts ?? '') > (prev.ts ?? '')) tmap.set(t.key, t)
  }
  const tombstones = [...tmap.values()]

  const tables = {}
  for (const name of SYNC_TABLES) {
    const del = tombstones.filter((x) => x.table === name).map((x) => ({ id: x.rowId, ts: x.ts }))
    tables[name] = mergeCollection(local?.tables?.[name] ?? [], remote?.tables?.[name] ?? [], del)
  }
  return { v: 1, tables, tombstones }
}

// ¿El snapshot A aporta algo que B no tiene? (para decidir si hace falta PUT).
export function differs(a, b) {
  return JSON.stringify(a?.tables ?? {}) !== JSON.stringify(b?.tables ?? {}) ||
    JSON.stringify(a?.tombstones ?? []) !== JSON.stringify(b?.tombstones ?? [])
}
