// Entorno de test: IndexedDB simulada (para Dexie) + matchers de jsdom.
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../db.js'

// Cada test arranca con la base de datos y el almacenamiento limpios,
// para que el orden de los tests no importe.
afterEach(async () => {
  cleanup()
  localStorage.clear()
  await Promise.all(db.tables.map((t) => t.clear()))
})
