import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import Recado from './Recado.jsx'
import { addExpense, addPerson, createEvent, db } from '../db.js'
import { recadosDeDatos } from '../lib/recados.js'

/**
 * Lo que se prueba es lo que se ve: que con datos sale una frase, que sin nada
 * que decir **no se pinta un hueco**, y que la tanda de la IA guardada en el
 * móvil llega hasta la pantalla.
 */
describe('Recado', () => {
  let evento

  beforeEach(async () => {
    localStorage.clear()
    evento = await db.events.get(await createEvent({
      name: 'Ballenita 2026', startDate: '2026-08-01', endDate: '2026-08-08',
    }))
  })

  it('sin nada que contar no pinta nada', async () => {
    const { container } = render(<Recado evento={evento} />)
    await waitFor(() => expect(container.querySelector('.recado')).toBeNull())
  })

  it('sin evento tampoco', () => {
    const { container } = render(<Recado evento={null} />)
    expect(container.querySelector('.recado')).toBeNull()
  })

  // La frase se saca **al azar** de la bolsa, así que con datos suficientes para
  // disparar dos plantillas no se puede exigir una en concreto sin escribir un
  // test que falla una de cada dos veces. Lo que sí se puede exigir —y es lo que
  // importa— es que lo pintado sea una de las que el motor produce con esos datos.
  it('con gastos y gente dice una de las frases que salen de esos datos', async () => {
    const gasto = {
      description: 'Compra', amountCents: 5000, currency: 'EUR', category: 'compra',
      dateISO: '2026-08-02', payers: [], participantIds: [],
    }
    await addPerson(evento.id, { name: 'A', edad: 'adulto' })
    await addPerson(evento.id, { name: 'B', edad: 'adulto' })
    await addExpense(evento.id, gasto)

    const { container } = render(<Recado evento={evento} />)
    await waitFor(() => expect(container.querySelector('.recado')).not.toBeNull())

    const posibles = recadosDeDatos({
      evento,
      gastos: [gasto],
      personas: [{ edad: 'adulto' }, { edad: 'adulto' }],
    }).map((r) => r.texto)

    expect(posibles).toContain(container.querySelector('.recado span:last-child').textContent)
    // Y una de ellas es siempre el reparto, que es la que lleva los números.
    expect(posibles.some((t) => t.includes('50,00') && t.includes('25,00'))).toBe(true)
  })

  it('la tanda guardada en el móvil llega a la pantalla', async () => {
    localStorage.setItem(`ballena.recados.${evento.id}`, JSON.stringify({
      recados: [{ emoji: '🍉', texto: 'Sandía otra vez.' }],
      pedidaEn: Date.now(),
    }))

    render(<Recado evento={evento} />)
    await waitFor(() => expect(screen.getByText('Sandía otra vez.')).toBeInTheDocument())
    expect(screen.getByText('🍉')).toBeInTheDocument()
  })
})
