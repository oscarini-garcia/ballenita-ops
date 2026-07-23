// Transporte del documento compartido (JSONBin.io), como counter-ops.
// Sin credenciales, la app funciona en local; la sync queda desactivada.
const BASE = 'https://api.jsonbin.io/v3/b'
const ID = import.meta.env?.VITE_JSONBIN_ID
const KEY = import.meta.env?.VITE_JSONBIN_KEY

export const isConfigured = () => !!(ID && KEY)

export async function pull() {
  const res = await fetch(`${BASE}/${ID}/latest`, { headers: { 'X-Master-Key': KEY } })
  if (res.status === 404) return null // bin aún vacío
  if (!res.ok) throw new Error(`pull ${res.status}`)
  const json = await res.json()
  return json.record ?? null
}

export async function push(doc) {
  const res = await fetch(`${BASE}/${ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': KEY, 'X-Bin-Versioning': 'false' },
    body: JSON.stringify(doc),
  })
  if (!res.ok) throw new Error(`push ${res.status}`)
}
