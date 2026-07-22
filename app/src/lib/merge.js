// ─────────────────────────────────────────────────────────────────────────────
// Motor de merge — adaptado de counter-ops (§14).
//
// Modelo: cada evento es un documento con colecciones (familias, bungas, personas,
// gastos, liquidaciones, planes, cenas). Se sincroniza un doc por evento contra un
// documento compartido; el merge es:
//   - Unión por `id`.
//   - En colisión, gana el `updatedAt` más reciente (last-write-wins, §12.2).
//   - Los borrados se propagan con tombstones { id, ts }; un ítem re-editado
//     DESPUÉS de su borrado (updatedAt > ts del tombstone) revive.
// Todo lo pisado queda recuperable desde el historial (AuditLog, §9).
// ─────────────────────────────────────────────────────────────────────────────

// Colecciones que viven dentro de un evento.
export const COLLECTIONS = [
  'families',
  'bungas',
  'persons',
  'expenses',
  'settlements',
  'plans',
  'dinners',
]

export function tombstoneMap(deleted = []) {
  const map = new Map()
  for (const t of deleted) {
    const id = typeof t === 'string' ? t : t?.id
    if (!id) continue
    const ts = typeof t === 'string' ? '' : (t.ts ?? '')
    if (!map.has(id) || ts > map.get(id)) map.set(id, ts)
  }
  return map
}

function isDeleted(tombs, item) {
  if (!tombs.has(item.id)) return false
  // Sobrevive si se editó/recreó después del borrado.
  return !((item.updatedAt ?? '') > tombs.get(item.id))
}

export function unionTombstones(a = [], b = []) {
  const map = tombstoneMap([...a, ...b])
  return [...map.entries()].map(([id, ts]) => (ts ? { id, ts } : id))
}

/** Une dos colecciones por id con LWW y respetando tombstones. */
export function mergeCollection(local = [], remote = [], deleted = []) {
  const tombs = tombstoneMap(deleted)
  const map = new Map()
  for (const it of local) if (!isDeleted(tombs, it)) map.set(it.id, it)
  for (const it of remote) {
    if (isDeleted(tombs, it)) continue
    const cur = map.get(it.id)
    if (!cur) map.set(it.id, it)
    else if ((it.updatedAt ?? '') > (cur.updatedAt ?? '')) map.set(it.id, it)
  }
  return [...map.values()]
}

/**
 * Une dos documentos de evento completos.
 * doc = { id, updatedAt, meta{}, families[], …, tombstones{ collection: [{id,ts}] } }
 */
export function mergeEventDoc(local, remote) {
  if (!remote) return local
  if (!local) return remote

  const tombstones = {}
  for (const c of COLLECTIONS) {
    tombstones[c] = unionTombstones(local.tombstones?.[c], remote.tombstones?.[c])
  }

  const merged = {
    id: local.id,
    // Metadatos del evento (nombre, fechas, moneda…): LWW por updatedAt.
    meta: (remote.meta?.updatedAt ?? '') > (local.meta?.updatedAt ?? '')
      ? remote.meta
      : local.meta,
    tombstones,
  }
  for (const c of COLLECTIONS) {
    merged[c] = mergeCollection(local[c] ?? [], remote[c] ?? [], tombstones[c])
  }
  merged.updatedAt =
    (remote.updatedAt ?? '') > (local.updatedAt ?? '') ? remote.updatedAt : local.updatedAt
  return merged
}
