/**
 * La guardia de las notas de versión (`lib/notas.js`, SPECS §14.34).
 *
 * La instrucción que esto vigila es «antes de cada merge se apunta qué
 * cambió», y la única manera de que eso sea una propiedad del repositorio y no
 * de la memoria es que las pruebas se pongan en rojo cuando se salta: una rama
 * que sube la versión sin describirla —o que describe una sin subirla— no
 * llega verde a `main`. Es la figura de `meeting-ops-air`, que además ataba el
 * bump; aquí la versión se sube a mano y esta guardia es la que avisa.
 */
import { describe, it, expect } from 'vitest'
import { NOTAS } from './notas.js'
import pkg from '../../package.json'

describe('las notas de versión', () => {
  it('la entrada de arriba describe la versión que se está construyendo', () => {
    expect(NOTAS[0].version, 'notas.js no describe la versión de package.json').toBe(pkg.version)
  })

  it('hay historia para llenar las cuatro tarjetas, y va de nueva a vieja', () => {
    expect(NOTAS.length, 'la pantalla enseña cuatro tarjetas').toBeGreaterThanOrEqual(4)
    const partes = (v) => v.split('.').map(Number)
    for (let i = 1; i < NOTAS.length; i += 1) {
      const [a, b] = [partes(NOTAS[i - 1].version), partes(NOTAS[i].version)]
      const baja = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))
      expect(baja, `${NOTAS[i - 1].version} no está por encima de ${NOTAS[i].version}`).toBe(true)
    }
  })

  it('cada entrada está entera: versión, fecha, titular y unas pocas líneas', () => {
    for (const n of NOTAS) {
      expect(n.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(n.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(n.titulo?.trim(), `${n.version} no tiene titular`).toBeTruthy()
      expect(Array.isArray(n.lineas) && n.lineas.length >= 1 && n.lineas.length <= 6,
        `${n.version} necesita entre una y seis líneas`).toBe(true)
      for (const l of n.lineas) expect(l.trim(), `${n.version} tiene una línea vacía`).toBeTruthy()
    }
  })
})
