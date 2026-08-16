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
    expect(screen.getByText(/los tocan los adultos/)).toBeInTheDocument()
    // La fila no es un botón: no hay ficha que abrir ni gesto que deslice.
    expect(screen.getByText('Helados').closest('button')).toBeNull()
  })

  it('el adolescente pesa como un adulto, pero Dinero tampoco es suyo', async () => {
    const adolescente = await addPerson(evento.id, { name: 'Teo', edad: 'adolescente', familyId: familia })
    localStorage.setItem(`ballena.me:${evento.id}`, adolescente)
    const { container } = render(<ExpensesScreen eventId={evento.id} event={evento} />)
    await screen.findByText('Helados')

    expect(container.querySelector('.fab')).toBeNull()
    expect(screen.getByText(/los tocan los adultos/)).toBeInTheDocument()
    // Y el peso no cambia: en el reparto cuenta 1, como un adulto.
    expect((await db.persons.get(adolescente)).pesoReparto).toBe(1)
    expect((await db.persons.get(adolescente)).comeConMayores).toBe(true)
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
    // Ni el «Deshacer» de un pago ya apuntado (§14.51), que mueve el mismo
    // saldo en el sentido contrario: sin gesto detrás de la fila.
    expect(document.querySelector('.deslizable')).toBeNull()
  })

  /**
   * **Ya no son dos estados sino tres** (§14.61). Un miembro sin identidad
   * puesta sigue siendo el caso de antes: mira. Lo que cambia es que un adulto
   * **con** identidad edita lo de su familia y los bungas, y eso se prueba en
   * `lib/permisos.test.js` y en el propio Grupo.
   */
  it('con sesión de miembro y sin saber quién eres, El grupo es el censo', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_m', rol: 'miembro' } })
    render(<GrupoSection eventId={evento.id} />)
    await screen.findByText('García')

    expect(screen.queryByText('+ Familia')).toBeNull()
    expect(screen.queryByText('+ Persona')).toBeNull()
    // Y se dice por qué: una pantalla que no reacciona y se calla es peor.
    expect(screen.getByText(/lo lleva quien administra|adultos del grupo/)).toBeInTheDocument()
  })

  it('un adulto sí edita lo de su familia, y no la de al lado', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_m', rol: 'miembro' } })
    localStorage.setItem(`ballena.me:${evento.id}`, adulto)
    render(<GrupoSection eventId={evento.id} />)

    expect(await screen.findByRole('button', { name: /Editar «García»/ })).toBeInTheDocument()
    // Crear y borrar familias mueve el reparto de todos: eso sigue sin salir.
    expect(screen.queryByText('+ Familia')).toBeNull()
  })

  it('y los bungas los toca cualquier adulto, aunque no sean el suyo', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_m', rol: 'miembro' } })
    localStorage.setItem(`ballena.me:${evento.id}`, adulto)
    render(<GrupoSection eventId={evento.id} area="bungas" />)

    // Colocar a las familias lo hace quien llega primero al camping.
    expect(await screen.findByText('+ Bunga')).toBeInTheDocument()
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
