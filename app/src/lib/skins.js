import { useEffect, useState } from 'react'

// Temas disponibles. `sistema` = claro/oscuro automático (sin data-skin).
export const SKINS = [
  { id: 'sistema', name: 'Sistema', emoji: '🌗', desc: 'Claro/oscuro automático' },
  { id: 'abisal', name: 'Abisal Fiesta', emoji: '🌊', desc: 'Azul profundo festivo' },
  { id: 'chiringuito', name: 'Chiringuito', emoji: '🌅', desc: 'Atardecer cálido' },
  { id: 'verbena', name: 'Verbena Neón', emoji: '🪩', desc: 'Noche de neón' },
  { id: 'cuaderno', name: 'Cuaderno', emoji: '📓', desc: 'Diario de viaje' },
  { id: 'aqua', name: 'Aqua Glass', emoji: '💎', desc: 'Cristal marino' },
]

export const POOL = ['abisal', 'chiringuito', 'verbena', 'cuaderno', 'aqua']
const PREF_KEY = 'ballena.skin'
const RND_KEY = 'ballena.skin.random'
const DEFAULT_SKIN = 'abisal' // el azul festivo de la marca por defecto

// El modo aleatorio "tira los dados" una vez al día (por día natural local).
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function getPref() {
  return localStorage.getItem(PREF_KEY) || DEFAULT_SKIN
}
export function setPref(p) {
  localStorage.setItem(PREF_KEY, p)
}

function pickDifferent(from) {
  if (POOL.length <= 1) return POOL[0]
  let next = from
  while (next === from) next = POOL[Math.floor(Math.random() * POOL.length)]
  return next
}

// Devuelve el skin del modo aleatorio; cambia al girar el día (o si `force`).
export function rollRandom(force = false) {
  let cur = null
  try { cur = JSON.parse(localStorage.getItem(RND_KEY)) } catch { /* ignore */ }
  const day = todayKey()
  if (force || !cur?.id || cur.day !== day) {
    cur = { id: pickDifferent(cur?.id ?? null), day }
    localStorage.setItem(RND_KEY, JSON.stringify(cur))
  }
  return cur.id
}

// El skin concreto a aplicar ahora mismo (resuelve 'random' → uno de POOL).
export function currentSkin() {
  const p = getPref()
  return p === 'random' ? rollRandom(false) : p
}

// Aplica el skin al <html>. `sistema` quita el atributo (vuelve al auto).
export function applySkin() {
  const s = currentSkin()
  const root = document.documentElement
  if (s === 'sistema') root.removeAttribute('data-skin')
  else root.setAttribute('data-skin', s)
  return s
}

// Hook para la UI de Ajustes.
export function useSkin() {
  const [pref, setP] = useState(getPref())
  const [current, setCurrent] = useState(currentSkin())

  useEffect(() => {
    setCurrent(applySkin())
    // Mientras la app está abierta y en modo aleatorio, comprueba cada minuto
    // si toca cambiar de tema (rota cada 30 min).
    const iv = setInterval(() => {
      if (getPref() === 'random') setCurrent(applySkin())
    }, 60 * 1000)
    return () => clearInterval(iv)
  }, [pref])

  return {
    pref,
    current,
    choose(p) { setPref(p); if (p === 'random') rollRandom(true); setP(p); setCurrent(applySkin()) },
    reroll() { setPref('random'); rollRandom(true); setP('random'); setCurrent(applySkin()) },
  }
}
