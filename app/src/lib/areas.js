import { useState } from 'react'

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

export function useArea(seccion, defecto) {
  const [area, setArea] = useState(() => elegidas.get(seccion) ?? defecto)
  return [area, (id) => { elegidas.set(seccion, id); setArea(id) }]
}

/** Para los tests, y para cuando se cierra sesión y se olvida todo. */
export function olvidarAreas() { elegidas.clear() }
