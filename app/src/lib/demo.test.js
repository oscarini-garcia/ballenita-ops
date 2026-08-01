import { describe, it, expect, beforeEach } from 'vitest'
import { db, listEvents } from '../db.js'
import { activarDemo, enDemo, salirDemo } from './demo.js'

// El modo de demostración es lo único que deja ver la aplicación a quien no está
// invitado —el equipo de revisión de Apple, sin ir más lejos—, así que estas
// pruebas son las que impiden que se retire sin querer. Ver `lib/demo.js`.
describe('modo de demostración', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    for (const tabla of db.tables) await tabla.clear()
  })

  it('no está activo por defecto', () => {
    expect(enDemo()).toBe(false)
  })

  it('al activarse siembra un evento y queda marcado', async () => {
    const id = await activarDemo()
    expect(enDemo()).toBe(true)
    expect(id).toBeTruthy()
    expect(await listEvents()).toHaveLength(1)
  })

  it('activarlo dos veces no duplica el evento', async () => {
    await activarDemo()
    const segunda = await activarDemo()
    expect(segunda).toBeNull()
    expect(await listEvents()).toHaveLength(1)
  })

  it('al salir se borra lo sembrado y la marca', async () => {
    await activarDemo()
    await salirDemo()
    expect(enDemo()).toBe(false)
    expect(await listEvents()).toHaveLength(0)
    // Y también la cola: si quedara, subiría un camping inventado al grupo en
    // cuanto alguien entrara de verdad desde este mismo móvil.
    expect(await db.outbox.count()).toBe(0)
  })
})
