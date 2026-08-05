import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExpensesScreen from './ExpensesScreen.jsx'
import { createEvent, addFamily, addPerson, addExpense, expensesOf } from '../db.js'
import { setMeId } from '../lib/identidad.js'

// Los creadores de `db.js` devuelven el id, no la fila.
const FECHA = '2026-08-12T18:00:00.000Z'

async function sembrar({ conGasto = true } = {}) {
  const eventId = await createEvent({ name: 'Ballenita', startDate: '2026-08-09', endDate: '2026-08-16' })
  const garcia = await addFamily(eventId, { name: 'García' })
  const perez = await addFamily(eventId, { name: 'Pérez' })
  const curro = await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto', pesoReparto: 1 })
  const ana = await addPerson(eventId, { name: 'Ana', familyId: perez, edad: 'adulto', pesoReparto: 1 })
  const nino = await addPerson(eventId, { name: 'Pablo', familyId: perez, edad: 'nino', pesoReparto: 0.6 })
  if (conGasto) {
    await addExpense(eventId, {
      description: 'Cañas en el chiringuito',
      amountCents: 2460,
      currency: 'EUR',
      amountOriginal: 24.6,
      rate: 1,
      category: 'bebida',
      dateISO: FECHA,
      payers: [{ familyId: garcia, amountCents: 2460 }],
      participantIds: [curro, ana, nino],
    })
  }
  return {
    eventId, garcia, perez, curro, ana, nino,
    event: { id: eventId, name: 'Ballenita', currency: 'EUR' },
  }
}

/** Abre la fila arrastrándola hacia la izquierda, como haría un pulgar. */
function deslizar(cara) {
  fireEvent.pointerDown(cara, { clientX: 300, clientY: 100, pointerId: 1, pointerType: 'touch' })
  fireEvent.pointerMove(cara, { clientX: 240, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(cara, { clientX: 160, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(cara, { clientX: 160, clientY: 100, pointerId: 1 })
}

// Las teclas que no se llaman como lo que llevan escrito (`aria-label`).
const ROTULO = { '00': 'Dos ceros', '+': 'Sumar', '−': 'Restar', '=': 'Confirmar la operación' }
/** Teclea en el pad de la ficha: `await pad('2', '4', '3', '0')`. */
async function pad(...teclas) {
  for (const t of teclas) await userEvent.click(screen.getByRole('button', { name: ROTULO[t] ?? t }))
}

beforeEach(() => { localStorage.clear() })

describe('Gastos · la lista', () => {
  it('la fila enseña el importe, que es a lo que se entra aquí', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Cañas en el chiringuito')).toBeInTheDocument()
    expect(screen.getAllByText(/24,60/).length).toBeGreaterThan(0)
    // Y ya no lleva un botón de borrar puesto encima del hueco del importe.
    expect(screen.queryByRole('button', { name: /^borrar$/i })).not.toBeInTheDocument()
  })

  it('deslizar la fila descubre Editar y Borrar', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cañas en el chiringuito')

    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('hidden')
    deslizar(document.querySelector('.deslizable-cara'))
    expect(document.querySelector('.deslizable-verbos').style.visibility).toBe('visible')
    expect(screen.getByRole('button', { name: /Editar/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Borrar/ })).toBeInTheDocument()
  })

  // B3 · escribir dejó de ser obligatorio, así que la fila necesitaba un nombre
  // para los días en que nadie escribe nada.
  it('sin descripción, la fila se llama por su categoría', async () => {
    const { eventId, event, garcia, curro } = await sembrar({ conGasto: false })
    await addExpense(eventId, {
      description: '', amountCents: 2430, currency: 'EUR', category: 'bebida', dateISO: FECHA,
      payers: [{ familyId: garcia, amountCents: 2430 }], participantIds: [curro],
    })
    render(<ExpensesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText('Bebida')).toBeInTheDocument()
  })

  // B2 · el reparto raro es lo único que hoy no se veía sin abrir el gasto.
  it('y el subtítulo dice quién pagó y, si el reparto no fue el de todos, cuál', async () => {
    const { eventId, event, garcia, curro, ana } = await sembrar({ conGasto: false })
    await addExpense(eventId, {
      description: 'Gin-tonics', amountCents: 2430, currency: 'EUR', category: 'bebida', dateISO: FECHA,
      payers: [{ familyId: garcia, amountCents: 2430 }], participantIds: [curro, ana],
    })
    render(<ExpensesScreen eventId={eventId} event={event} />)

    expect(await screen.findByText(/Bebida · pagó García · sin los niños/)).toBeInTheDocument()
  })
})

describe('Gastos · apuntar sin teclado', () => {
  it('la ficha no abre el teclado del sistema: no hay nada con el foco puesto', async () => {
    const { eventId, event } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await screen.findByRole('dialog', { name: 'Nuevo gasto' })
    expect(document.activeElement.tagName).not.toBe('INPUT')
    expect(document.querySelector('.ficha-gasto input')).toBeNull()
  })

  it('2·4·3·0 son 24,30 €, y se guarda sin escribir una letra', async () => {
    const { eventId, event, garcia, curro, ana, nino } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('2', '4', '3', '0')
    expect(screen.getByText('24,30')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Bebida' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.amountCents).toBe(2430)
      expect(g.description).toBe('')
      expect(g.category).toBe('bebida')
      // Los valores por defecto se guardan aunque no se toquen: paga una familia
      // y se divide entre todos, que es lo que decía la ficha.
      expect(g.payers).toEqual([{ familyId: garcia, amountCents: 2430 }])
      expect([...g.participantIds].sort()).toEqual([curro, ana, nino].sort())
      expect(g.reparto).toBeNull()
    })
  })

  it('dos tickets se suman en la propia ficha: 18,40 + 5,90', async () => {
    const { eventId, event } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('1', '8', '4', '0')
    await userEvent.click(screen.getByRole('button', { name: 'Sumar' }))
    await pad('5', '9', '0')

    // La cinta enseña la operación y la cifra grande el resultado en vivo: `=`
    // confirma, pero no revela nada que no estuviera ya puesto.
    expect(screen.getByText('18,40 + 5,90')).toBeInTheDocument()
    expect(screen.getByText('24,30')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.amountCents).toBe(2430)
    })
  })

  // El botón hacía `return` en silencio si faltaba algo, y callarlo se lee como
  // que la app no funciona (§14.16-ter: el estado vive en el campo).
  it('sin importe el botón está apagado y dice por qué', async () => {
    const { eventId, event } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    expect(await screen.findByRole('button', { name: 'Guardar gasto' })).toBeDisabled()
    expect(screen.getByText(/Teclea el importe/)).toBeInTheDocument()

    await pad('5', '0', '0')
    expect(screen.getByRole('button', { name: 'Guardar gasto' })).toBeEnabled()
  })

  it('paga tu familia, no la primera de la lista', async () => {
    const { eventId, event, perez, ana } = await sembrar({ conGasto: false })
    setMeId(eventId, ana) // Ana es de los Pérez, y García va antes por orden.
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('5', '00')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.payers[0].familyId).toBe(perez)
    })
  })
})

describe('Gastos · los dos renglones y las dos hojas', () => {
  it('«Paga» dice quién y se toca para cambiarlo', async () => {
    const { eventId, event, perez } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('5', '00')
    await userEvent.click(screen.getByRole('button', { name: /Paga García/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Pérez/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.payers[0].familyId).toBe(perez)
    })
  })

  it('«Entre» dice cuántos, y el atajo «Mayores» deja fuera a los niños', async () => {
    const { eventId, event, curro, ana } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('5', '00')
    await userEvent.click(screen.getByRole('button', { name: /Entre todos \(3\)/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mayores' }))
    await userEvent.click(screen.getByRole('button', { name: 'Listo' }))

    // El renglón lo dice sin abrir nada: lo que no se ve, no se corrige.
    expect(await screen.findByText('sin los niños')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect([...g.participantIds].sort()).toEqual([curro, ana].sort())
    })
  })

  // La hoja escribía en la ficha en cada toque, así que salir por el fondo
  // guardaba. Ahora trabaja sobre un borrador (§14.27).
  it('y cancelar en esa hoja deja el reparto como estaba', async () => {
    const { eventId, event, curro, ana, nino } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('5', '00')
    await userEvent.click(screen.getByRole('button', { name: /Entre todos \(3\)/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Nadie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(await screen.findByText('todos (3)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))
    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect([...g.participantIds].sort()).toEqual([curro, ana, nino].sort())
    })
  })
})

describe('Gastos · Detalles', () => {
  it('la descripción vive ahí y ya no es obligatoria para guardar', async () => {
    const { eventId, event } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('2', '4', '3', '0')
    await userEvent.click(screen.getByRole('button', { name: /Detalles/ }))
    await userEvent.type(await screen.findByLabelText(/Descripción/), 'Hielo y birras')
    await userEvent.click(screen.getByRole('button', { name: 'Hecho' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.description).toBe('Hielo y birras')
      expect(g.amountCents).toBe(2430)
    })
  })

  it('«la mitad los Pérez» se puede decir, y se guarda en céntimos', async () => {
    const { eventId, event, garcia, perez } = await sembrar({ conGasto: false })
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Añadir gasto' }))

    await pad('2', '4', '00')
    await userEvent.click(screen.getByRole('button', { name: /Detalles/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Importes' }))

    // Entra ya repartido a partes iguales: una pantalla de ceros obligaría a
    // teclear tres números para no cambiar nada.
    expect(screen.getByLabelText('García')).toHaveValue(12)
    await userEvent.clear(screen.getByLabelText('García'))
    await userEvent.type(screen.getByLabelText('García'), '18')
    // Y el último renglón lleva lo que falte, así que no se puede descuadrar.
    expect(screen.getByText('6,00 €')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Hecho' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(async () => {
      const [g] = await expensesOf(eventId)
      expect(g.reparto).toEqual({ modo: 'importes', porFamilia: { [garcia]: 1800, [perez]: 600 } })
    })
  })
})

describe('Gastos · corregir', () => {
  it('arranca con la cifra puesta, la corrige con ⌫ y le respeta la fecha', async () => {
    const { eventId, event } = await sembrar()
    render(<ExpensesScreen eventId={eventId} event={event} />)
    await screen.findByText('Cañas en el chiringuito')

    deslizar(document.querySelector('.deslizable-cara'))
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }))

    // La ficha arranca con lo que ya había: es una corrección, no un alta.
    await screen.findByRole('dialog', { name: 'Corregir gasto' })
    expect(screen.getByText('24,60')).toBeInTheDocument()

    // En registradora, corregir 24,60 a 26,40 es borrar y volver a teclear: `C`
    // está justo para eso, porque a golpe de ⌫ serían cuatro toques y luego cuatro.
    await userEvent.click(screen.getByRole('button', { name: 'Borrar un dígito' }))
    expect(screen.getByText('2,46')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Borrar la operación entera' }))
    await pad('2', '6', '4', '0')
    expect(screen.getByText('26,40')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Guardar los cambios' }))

    await waitFor(async () => {
      const gastos = await expensesOf(eventId)
      expect(gastos).toHaveLength(1)
      expect(gastos[0].amountCents).toBe(2640)
      // La fecha es cuándo se gastó, no cuándo se cayó en la cuenta del error.
      expect(gastos[0].dateISO).toBe(FECHA)
    })
  })
})
