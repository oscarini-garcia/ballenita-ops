// IDs generados en cliente (§12.2): así dos dispositivos offline no chocan al sincronizar.
export function uid(prefix = '') {
  const rnd =
    (globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
  return prefix ? `${prefix}_${rnd}` : rnd
}

// Marca de tiempo ISO — se usa como reloj para el last-write-wins del merge (§14).
export function now() {
  return new Date().toISOString()
}
