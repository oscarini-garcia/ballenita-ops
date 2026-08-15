import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BalancesScreen from './BalancesScreen.jsx'
import {
  db, createEvent, getEvent, addFamily, addPerson, addExpense, settlementsOf,
} from '../db.js'

/** Abre la fila arrastrándola hacia la izquierda, como haría un pulgar. */
function deslizar(cara) {
  fireEvent.pointerDown(cara, { clientX: 300, clientY: 100, pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerMove(cara, { clientX: 240, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(cara, { clientX: 160, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(cara, { clientX: 160, clientY: 100, pointerId: 1 })
}

/**
 * Saldos, decidido en `docs/diseño/saldos.html` · F3 · R2 · E1.
 *
 * La semilla son los tres gastos del Demo, que dan saldos de verdad: los García
 * deben 91,85 €, y se salda con 70,56 € a los Pérez y 21,29 € a los Solteros.
 */
async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita 2026', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B' })
  const perez = await addFamily(eventId, { name: 'Pérez', color: '#2E9E6B' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6' })
  const ids = []
  for (const [name, familyId] of [
    ['Curro', garcia], ['Marta', garcia], ['Fran', garcia],
    ['Ana', perez], ['Luis', perez], ['Pablo', solteros],
  ]) ids.push(await addPerson(eventId, { name, familyId, edad: 'adulto' }))

  const comun = { currency: 'EUR', dateISO: new Date().toISOString(), participantIds: ids }
  await addExpense(eventId, { ...comun, description: 'Compra grande', amountCents: 14800, category: 'compra_general', payers: [{ familyId: perez, amountCents: 14800 }] })
  await addExpense(eventId, { ...comun, description: 'Gasolina', amountCents: 6000, category: 'varios', payers: [{ familyId: solteros, amountCents: 6000 }] })
  await addExpense(eventId, { ...comun, description: 'Hielo', amountCents: 2430, category: 'bebida', payers: [{ familyId: garcia, amountCents: 2430 }] })
  return { eventId, event: await getEvent(eventId) }
}

const filaCon = (texto) =>
  [...document.querySelectorAll('.card .row')].find((f) => f.textContent.includes(texto))

/**
 * La fila, **esperándola**. La pantalla monta cuatro consultas vivas —gastos,
 * familias, personas y pagos— que **resuelven por separado**: con los gastos
 * dentro y las familias todavía no, el encabezado ya está pintado y las filas
 * dicen «— → —». Buscar la fila en cuanto aparece el encabezado es una carrera
 * contra la consulta de familias, y se pierde una de cada veinte veces (es lo
 * que tumbó el flujo del OTA de la v0.29.0).
 */
const esperaFila = (texto) => waitFor(() => {
  const f = filaCon(texto)
  expect(f, `la fila «${texto}»`).toBeTruthy()
  return f
})

describe('BalancesScreen', () => {
  beforeEach(async () => {
    for (const t of ['events', 'families', 'persons', 'expenses', 'settlements', 'outbox']) await db[t].clear()
  })

  /** F3: la familia con su pastilla de dos letras, y sin el emoji sobre el color. */
  it('nombra cada familia con su pastilla de iniciales, no con su emoji', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Saldo por familia')

    const perez = await esperaFila('Pérez')
    expect(perez.querySelector('.alias').textContent).toBe('PE')
    // La casilla del emoji se fue: el color vive ahora en la pastilla.
    expect(perez.querySelector('.av')).toBeNull()
  })

  /**
   * Los importes se comprueban **sin el céntimo**, y no es pereza: el céntimo
   * que sobra al repartir cae en una familia u otra según el orden de los ids
   * (`splitCents`), y los ids son de cliente —`crypto.randomUUID()`—, así que
   * cambian en cada ejecución. Una primera versión de esta prueba afirmaba
   * «91,85» y pasó en local; en CI salió 91,86 una vez y 91,84 otra, y tumbó
   * el flujo del OTA. Lo estable —y lo que de verdad importa— es el signo, la
   * cifra y que las cuentas cuadren.
   */
  it('cuenta los saldos de verdad, y quién debe y a quién le deben', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Saldo por familia')

    const garcia = await esperaFila('García')
    expect(garcia.textContent).toContain('debe')
    expect(garcia.querySelector('.amt').textContent).toMatch(/91,8\d/)
    expect(filaCon('Pérez').querySelector('.amt').textContent).toMatch(/\+70,5\d/)

    // Y las cuentas cuadran: de tres familias, una debe y a dos les deben.
    expect(document.querySelectorAll('.card .row .amt.owe')).toHaveLength(1)
    expect(document.querySelectorAll('.card .row .amt.owed')).toHaveLength(2)
  })

  /** R2: dos líneas, quién paga a quién arriba y el importe debajo. */
  it('el renglón de saldar dice quién paga a quién, sin «transferencia pendiente»', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    expect(screen.queryByText('transferencia pendiente')).toBeNull()
    expect(screen.queryByText(/Cómo saldar/)).toBeNull()

    const fila = await esperaFila('García → Pérez')
    // Sin el «€» en el patrón: `Intl` separa la moneda con un espacio duro.
    expect(fila.querySelector('.sub').textContent).toMatch(/70,5\d/)
    // El verbo va al lado y en una palabra, no apilado bajo la cifra.
    expect(fila.querySelector('button').textContent).toBe('pagado')
  })

  it('marcar un pago lo apunta y lo baja a «Pagos apuntados» con la misma figura', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    const fila = await esperaFila('García → Pérez')
    await userEvent.click(fila.querySelector('button'))

    expect(await screen.findByText('Pagos apuntados')).toBeInTheDocument()
    // La base se lee **esperando**: entre el toque y la fila escrita hay una
    // escritura asíncrona, y leerla a pelo es una carrera contra ella.
    await waitFor(async () => {
      const apuntados = await settlementsOf(eventId)
      expect(apuntados).toHaveLength(1)
      // El céntimo del redondeo cae en una familia u otra según el orden de los
      // ids, que son de cliente: lo que se comprueba es que apunta el importe de
      // la transferencia, no un número escrito a mano.
      expect(apuntados[0].amountCents).toBeGreaterThan(7000)
    })
  })

  /**
   * El arreglo del tercer defecto: una persona sin familia es una «familia de
   * uno», y todas se llamaban «Sin familia».
   */
  it('una persona sin familia sale con su nombre, no como «Sin familia»', async () => {
    const eventId = await createEvent({ name: 'Sueltos', currency: 'EUR' })
    const fam = await addFamily(eventId, { name: 'García' })
    const curro = await addPerson(eventId, { name: 'Curro', familyId: fam, edad: 'adulto' })
    const suelta = await addPerson(eventId, { name: 'Berta', edad: 'adulto' })
    await addExpense(eventId, {
      description: 'Taxi', amountCents: 2000, currency: 'EUR', category: 'varios',
      dateISO: new Date().toISOString(), payers: [{ familyId: fam, amountCents: 2000 }],
      participantIds: [curro, suelta],
    })
    render(<BalancesScreen eventId={eventId} event={await getEvent(eventId)} />)
    await screen.findByText('Saldo por familia')

    const berta = await esperaFila('Berta')
    expect(screen.queryByText('Sin familia')).toBeNull()
    // Sin familia dueña no hay color, pero sí sus dos letras.
    expect(berta.querySelector('.alias').textContent).toBe('BE')
  })

  /**
   * §14.51: `removeSettlement` existía en `db.js` desde siempre y **no lo
   * llamaba nadie**. Un toque sin querer en «pagado» metía una liquidación que
   * ya no se quitaba desde la app y descuadraba el saldo de dos familias.
   */
  it('un pago apuntado se puede deshacer, y la pregunta dice qué vuelve a deberse', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    const fila = await esperaFila('García → Pérez')
    await userEvent.click(fila.querySelector('button'))
    await screen.findByText('Pagos apuntados')
    await waitFor(async () => expect(await settlementsOf(eventId)).toHaveLength(1))

    // El verbo vive detrás del gesto, como en Gastos: no ocupa sitio en la fila.
    const cara = document.querySelector('.lista-deslizable .deslizable-cara')
    expect(document.querySelector('.lista-deslizable .deslizable-verbos').style.visibility).toBe('hidden')
    deslizar(cara)
    await userEvent.click(screen.getByRole('button', { name: /Deshacer/ }))

    // Y pregunta diciendo el efecto, que es el contrario del que se ve.
    expect(await screen.findByText(/vuelve a deber/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, deshacer' }))

    await waitFor(async () => expect(await settlementsOf(eventId)).toHaveLength(0))
    // Y la deuda vuelve a estar donde estaba.
    expect(await esperaFila('García → Pérez')).toBeTruthy()
  })

  it('«Dejarlo» no deshace nada', async () => {
    const { eventId, event } = await sembrar()
    render(<BalancesScreen eventId={eventId} event={event} />)
    await screen.findByText('Quién paga a quién')

    await userEvent.click((await esperaFila('García → Pérez')).querySelector('button'))
    await screen.findByText('Pagos apuntados')
    await waitFor(async () => expect(await settlementsOf(eventId)).toHaveLength(1))

    deslizar(document.querySelector('.lista-deslizable .deslizable-cara'))
    await userEvent.click(screen.getByRole('button', { name: /Deshacer/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Dejarlo' }))

    expect(await settlementsOf(eventId)).toHaveLength(1)
    expect(screen.queryByText(/vuelve a deber/)).toBeNull()
  })

  it('sin gastos no hay cuentas que echar', async () => {
    const eventId = await createEvent({ name: 'Vacío', currency: 'EUR' })
    render(<BalancesScreen eventId={eventId} event={await getEvent(eventId)} />)
    expect(await screen.findByText(/Sin gastos, sin cuentas/)).toBeInTheDocument()
  })
})
