import { useEffect, useState } from 'react'

/**
 * El área elegida dentro de una sección, que no se olvida al salir y volver.
 *
 * Cada mando de áreas (`SubNav`) era un `useState` dentro de su pantalla, y la
 * pantalla se desmonta al cambiar de pestaña: mirabas la lista de días, saltabas
 * a Dinero a apuntar el hielo, volvías a Agenda y estabas otra vez en «Hoy».
 * Con dos áreas apenas se notaba; con Agenda partida en Hoy/Días se nota siempre.
 *
 * Vive en memoria del módulo y **no** en `localStorage` a propósito: es dónde
 * estabas hace un minuto, no una preferencia. Al arrancar la app, cada sección
 * empieza por su área de origen.
 */
const elegidas = new Map()

// Quien cambia el área desde fuera de su pantalla —la barra de abajo, al pulsar
// Agenda (§14.47)— tiene que despertar al mando que ya está montado: el mapa es
// memoria muda y `useState` no se entera solo.
const AVISO = 'ballena:area'

export function useArea(seccion, defecto) {
  const [area, setArea] = useState(() => elegidas.get(seccion) ?? defecto)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const alCambiar = (e) => {
      if (e.detail && e.detail !== seccion) return
      setArea(elegidas.get(seccion) ?? defecto)
    }
    window.addEventListener(AVISO, alCambiar)
    return () => window.removeEventListener(AVISO, alCambiar)
  }, [seccion, defecto])

  return [area, (id) => { elegidas.set(seccion, id); setArea(id) }]
}

/** Poner el área desde fuera, y que la pantalla montada se entere. */
export function ponerArea(seccion, id) {
  elegidas.set(seccion, id)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AVISO, { detail: seccion }))
  }
}

/** Para los tests, y para cuando se cierra sesión y se olvida todo. */
export function olvidarAreas() { elegidas.clear() }
