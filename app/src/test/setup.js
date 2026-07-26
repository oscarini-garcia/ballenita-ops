// Entorno de test: IndexedDB simulada (para Dexie) + matchers de jsdom.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../db.js'

// jsdom no implementa el scroll de la ventana y grita cada vez que se le llama.
// El bloqueo de scroll de los modales (lib/scrollLock.js) lo usa al cerrarse.
window.scrollTo = (x = 0, y = 0) => { window.scrollX = x; window.scrollY = y }

// Cada test arranca con la base de datos y el almacenamiento limpios,
// para que el orden de los tests no importe.
afterEach(async () => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-skin')
  await Promise.all(db.tables.map((t) => t.clear()))
})
