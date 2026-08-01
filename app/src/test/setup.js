// Entorno de test: IndexedDB simulada (para Dexie) + matchers de jsdom.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../db.js'

// jsdom no implementa el scroll de la ventana y grita cada vez que se le llama.
// El bloqueo de scroll de los modales (lib/scrollLock.js) lo usa al cerrarse.
window.scrollTo = (x = 0, y = 0) => { window.scrollX = x; window.scrollY = y }

// jsdom tampoco trae eventos de puntero. Sin esto, un `fireEvent.pointerMove`
// llega **sin `clientX`**, la resta da `NaN` y el gesto de deslizar una fila
// (components/Deslizable.jsx) parece no funcionar nunca — sin dar un solo error.
// `MouseEvent` sí trae las coordenadas, así que la clase se apoya en ella.
if (typeof window.PointerEvent === 'undefined') {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(tipo, init = {}) {
      super(tipo, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'touch'
    }
  }
}
// Y la captura de puntero, que es de la misma familia y tampoco está.
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}

// Cada test arranca con la base de datos y el almacenamiento limpios,
// para que el orden de los tests no importe.
afterEach(async () => {
  cleanup()
  localStorage.clear()
  document.documentElement.removeAttribute('data-skin')
  await Promise.all(db.tables.map((t) => t.clear()))
})
