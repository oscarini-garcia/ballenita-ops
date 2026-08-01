import { useEffect, useState } from 'react'

/**
 * Temas disponibles. `sistema` = claro/oscuro automático (sin data-skin).
 *
 * Van en dos grupos, y el grupo es un dato del tema (`grupo`) y no del sitio
 * donde se pintan: un tema con degradado de neón y otro pensado para leerlo al
 * sol no compiten por lo mismo, y mezclarlos en una sola tira de pastillas hace
 * que se elija el bonito y se sufra después. Los legibles son deliberadamente
 * sosos: máximo contraste, sin degradados de fondo y sin translúcidos.
 */
export const SKINS = [
  { id: 'sistema', name: 'Sistema', emoji: '🌗', desc: 'Claro/oscuro automático', grupo: 'legible' },
  { id: 'abisal', name: 'Abisal Fiesta', emoji: '🌊', desc: 'Azul profundo festivo', grupo: 'fiesta' },
  { id: 'chiringuito', name: 'Chiringuito', emoji: '🌅', desc: 'Atardecer cálido', grupo: 'fiesta' },
  { id: 'verbena', name: 'Verbena Neón', emoji: '🪩', desc: 'Noche de neón', grupo: 'fiesta' },
  { id: 'cuaderno', name: 'Cuaderno', emoji: '📓', desc: 'Diario de viaje', grupo: 'fiesta' },
  { id: 'aqua', name: 'Aqua Glass', emoji: '💎', desc: 'Cristal marino', grupo: 'fiesta' },
  { id: 'mediterraneo', name: 'Mediterráneo', emoji: '🍋', desc: 'Cal, limón y azul', grupo: 'fiesta' },
  { id: 'nitido', name: 'Nítido', emoji: '☀️', desc: 'Claro, máximo contraste', grupo: 'legible' },
  { id: 'tinta', name: 'Tinta', emoji: '🌑', desc: 'Oscuro, máximo contraste', grupo: 'legible' },
]

export const GRUPOS = [
  { id: 'legible', label: 'Para leer bien' },
  { id: 'fiesta', label: 'Con guasa' },
]

// El bombo del modo aleatorio. Los dos de alto contraste se quedan fuera a
// propósito: se eligen para poder leer, y un dado que te los quita mañana —o que
// te mete en uno de neón— es justo lo contrario de lo que se venía a pedir.
export const POOL = ['abisal', 'chiringuito', 'verbena', 'cuaderno', 'aqua', 'mediterraneo']
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
