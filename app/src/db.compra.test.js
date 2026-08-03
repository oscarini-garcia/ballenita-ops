import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import {
  db, createEvent, addPerson, addDish, addDinner, updateDinner, listDishes,
  addShopItem, shopItemsOf, markBought, sincronizarCompraDesdeCenas,
} from './db.js'

/**
 * La compra que sale de las cenas, y las tres cosas que no se puede llevar por
 * delante al rehacerla (SPECS §14.20 · E2).
 */
let eventId
let paella
let macarrones

async function estado() {
  const cenas = await db.dinners.where({ eventId }).toArray()
  const platos = await listDishes()
  const personas = await db.persons.where({ eventId }).toArray()
  return { cenas, platos, personas }
}

const porTexto = async (texto) => (await shopItemsOf(eventId)).find((x) => x.texto === texto)

beforeEach(async () => {
  for (const t of ['events', 'persons', 'dishes', 'dinners', 'shop', 'outbox']) await db[t].clear()
  eventId = await createEvent({ name: 'Ballenita 2026', startDate: '2026-08-08', endDate: '2026-08-12' })
  // Cuatro adultos y dos niños: mesa de mayores 4, mesa de niños 1,2.
  for (let i = 0; i < 4; i += 1) await addPerson(eventId, { name: `Adulto ${i}`, edad: 'adulto' })
  for (let i = 0; i < 2; i += 1) await addPerson(eventId, { name: `Niño ${i}`, edad: 'niño' })

  paella = await addDish({
    name: 'Paella mixta',
    raciones: 10,
    ingredientes: [{ nombre: 'Arroz', cantidad: 1, unidad: 'kg' }, { nombre: 'Azafrán' }],
  })
  macarrones = await addDish({
    name: 'Macarrones',
    raciones: 10,
    ingredientes: [{ nombre: 'Macarrones', cantidad: 1, unidad: 'kg' }],
  })
})

describe('la compra sale de las cenas', () => {
  it('una línea por ingrediente, con el total de las dos mesas', async () => {
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())

    const arroz = await porTexto('Arroz')
    // 1 kg para 10 raciones, y se sientan 5,2 → 0,52 kg.
    expect(arroz.cantidad).toBeCloseTo(0.52, 5)
    expect(arroz.desglose).toEqual({ mayores: 0.4, ninos: 0.12 })
    expect(arroz.origen).toBe('cena')
  })

  it('lo que no tiene cantidad sale igual, y se le nota', async () => {
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    expect((await porTexto('Azafrán')).cantidad).toBeNull()
  })
})

describe('cuando cambia una cena', () => {
  it('la cantidad se rehace y la línea dice de cuánto venía', async () => {
    const cena = await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    const antes = (await porTexto('Arroz')).cantidad

    // Los niños pasan a comer macarrones: el arroz ya solo es de los mayores.
    await updateDinner(cena, { platoIdsNinos: [macarrones] })
    const r = await sincronizarCompraDesdeCenas(eventId, await estado())

    const arroz = await porTexto('Arroz')
    expect(arroz.cantidad).toBeCloseTo(0.4, 5)
    expect(arroz.cambio.antes).toBeCloseTo(antes, 5)
    expect(r.cambiadas).toBe(1)
    // Y aparecen los macarrones, que antes no estaban.
    expect((await porTexto('Macarrones')).cantidad).toBeCloseTo(0.12, 5)
  })

  it('lo ya comprado no se toca: eso está en el carro', async () => {
    const cena = await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    const arroz = await porTexto('Arroz')
    await markBought(arroz.id, null)

    await updateDinner(cena, { platoIdsNinos: [macarrones] })
    await sincronizarCompraDesdeCenas(eventId, await estado())

    const despues = await porTexto('Arroz')
    expect(despues.cantidad).toBeCloseTo(0.52, 5)
    expect(despues.cambio).toBeNull()
  })

  it('lo escrito a mano no se toca nunca', async () => {
    // «Hielos» no es de ninguna receta, y la lista tiene que seguir siendo el
    // sitio donde se apunta lo que se te ocurre.
    await addShopItem(eventId, { texto: 'Hielos', categoria: 'hielo' })
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    await db.dinners.clear()
    await sincronizarCompraDesdeCenas(eventId, await estado())

    expect(await porTexto('Hielos')).toBeTruthy()
    expect(await porTexto('Arroz')).toBeUndefined()
  })

  it('lo que ya no está en ninguna cena se va, salvo si está comprado', async () => {
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    const azafran = await porTexto('Azafrán')
    await markBought(azafran.id, null)

    await db.dinners.clear()
    const r = await sincronizarCompraDesdeCenas(eventId, await estado())

    expect(await porTexto('Arroz')).toBeUndefined()
    // Quitarlo de la lista no lo saca del carro.
    expect(await porTexto('Azafrán')).toBeTruthy()
    expect(r.quitadas).toBe(1)
  })

  it('marcar la línea se lleva el «venía de»: ya se ha visto', async () => {
    const cena = await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    await updateDinner(cena, { platoIdsNinos: [macarrones] })
    await sincronizarCompraDesdeCenas(eventId, await estado())

    const arroz = await porTexto('Arroz')
    expect(arroz.cambio).toBeTruthy()
    await markBought(arroz.id, null)
    expect((await porTexto('Arroz')).cambio).toBeNull()
  })

  it('sin cambios no se reescribe nada', async () => {
    await addDinner(eventId, { dia: '2026-08-09', platoIds: [paella] })
    await sincronizarCompraDesdeCenas(eventId, await estado())
    const segunda = await sincronizarCompraDesdeCenas(eventId, await estado())
    expect(segunda).toEqual({ nuevas: 0, cambiadas: 0, quitadas: 0 })
  })
})
