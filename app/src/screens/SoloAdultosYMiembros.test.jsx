import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ExpensesScreen from './ExpensesScreen.jsx'
import BalancesScreen from './BalancesScreen.jsx'
import GrupoSection from './GrupoSection.jsx'
import { addExpense, addFamily, addPerson, createEvent, db } from '../db.js'
import { guardarSesion } from '../auth/sesion.js'

/**
 * Quién puede tocar qué (SPECS §14.41): Dinero escribe solo con identidad
 * adulta, y El grupo lo edita quien administra. Lo demás se mira igual.
 */
describe('dinero solo adultos, grupo solo lectura', () => {
  let evento
  let familia
  let nino
  let adulto

  beforeEach(async () => {
    localStorage.clear()
    evento = await db.events.get(await createEvent({
      name: 'Ballenita', startDate: '2026-08-01', endDate: '2026-08-08',
    }))
    familia = await addFamily(evento.id, { name: 'García', color: '#E5544B' })
    nino = await addPerson(evento.id, { name: 'Fran', edad: 'niño', familyId: familia })
    adulto = await addPerson(evento.id, { name: 'Mariona', edad: 'adulto', familyId: familia })
    await addExpense(evento.id, {
      description: 'Helados', amountCents: 900, currency: 'EUR', category: 'compra',
      dateISO: '2026-08-02', payers: [{ familyId: familia }], participantIds: [],
    })
  })

  it('con la identidad de un niño, Gastos es un escaparate', async () => {
    localStorage.setItem(`ballena.me:${evento.id}`, nino)
    const { container } = render(<ExpensesScreen eventId={evento.id} event={evento} />)
    await screen.findByText('Helados')

    expect(container.querySelector('.fab')).toBeNull()
    expect(screen.getByText(/los tocan los mayores/)).toBeInTheDocument()
    // La fila no es un botón: no hay ficha que abrir ni gesto que deslice.
    expect(screen.getByText('Helados').closest('button')).toBeNull()
  })

  it('con identidad adulta, los verbos están donde siempre', async () => {
    localStorage.setItem(`ballena.me:${evento.id}`, adulto)
    const { container } = render(<ExpensesScreen eventId={evento.id} event={evento} />)
    await screen.findByText('Helados')

    expect(container.querySelector('.fab')).not.toBeNull()
    expect(screen.queryByText(/los tocan los mayores/)).toBeNull()
    expect(screen.getByText('Helados').closest('button')).not.toBeNull()
  })

  it('el «pagado» de Saldos tampoco es para niños', async () => {
    // Un segundo pagador para que haya una transferencia pendiente.
    const otra = await addFamily(evento.id, { name: 'Solteros', color: '#2E9E6B' })
    await addPerson(evento.id, { name: 'Curro', edad: 'adulto', familyId: otra })

    localStorage.setItem(`ballena.me:${evento.id}`, nino)
    render(<BalancesScreen eventId={evento.id} event={evento} />)
    await screen.findByText('Saldo por familia')
    expect(screen.queryByRole('button', { name: 'pagado' })).toBeNull()
  })

  it('con sesión de miembro, El grupo es el censo: sin añadir ni editar', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_m', rol: 'miembro' } })
    render(<GrupoSection eventId={evento.id} />)
    await screen.findByText('García')

    expect(screen.queryByText('+ Familia')).toBeNull()
    expect(screen.queryByText('+ Persona')).toBeNull()
    expect(screen.getByText(/lo edita quien administra/)).toBeInTheDocument()
  })

  it('quien administra edita, y sin sesión —libreta local, demo— también', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_a', rol: 'administrador' } })
    const admin = render(<GrupoSection eventId={evento.id} />)
    await waitFor(() => expect(screen.getByText('+ Familia')).toBeInTheDocument())
    admin.unmount()

    localStorage.removeItem('ballena.sesion')
    render(<GrupoSection eventId={evento.id} />)
    await waitFor(() => expect(screen.getByText('+ Familia')).toBeInTheDocument())
  })
})
