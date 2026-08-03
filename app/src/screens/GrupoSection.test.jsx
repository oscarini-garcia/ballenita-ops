import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GrupoSection from './GrupoSection.jsx'
import {
  createEvent, addFamily, addBunga, addPerson,
  familiesOf, bungasOf, personsOf,
} from '../db.js'

async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B', avatar: '🏖️', estado: 'modo playa' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6', avatar: '🎉' })
  await addBunga(eventId, { name: 'Bunga 1', alias: 'el de la piscina', familyId: garcia })
  await addBunga(eventId, { name: 'Bunga 3', alias: 'el del fondo' })
  await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  return { eventId, garcia, solteros }
}

describe('El grupo — la ficha por familia (G2)', () => {
  it('cada familia enseña su bunga y su gente sin tocar nada', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    expect(await screen.findByText('García')).toBeTruthy()
    expect(await screen.findByText('el de la piscina')).toBeTruthy()
    expect(await screen.findByText('Curro')).toBeTruthy()
    // La familia sin bunga enseña el hueco, no un guion.
    expect(await screen.findByText('+ Bunga')).toBeTruthy()
  })

  it('lo que no está colocado cae en «Sueltos»', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    expect(await screen.findByText('Sueltos')).toBeTruthy()
    expect(await screen.findByText('Bunga 3')).toBeTruthy()
  })

  it('tocar la fila abre su editor (E1)', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('García'))
    expect(await screen.findByText('Editar familia')).toBeTruthy()
    expect(screen.getByLabelText('Nombre').value).toBe('García')
  })

  it('editar guarda el cambio en la base', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('García'))
    const campo = await screen.findByLabelText('Nombre')
    await userEvent.clear(campo)
    await userEvent.type(campo, 'Garcías')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const fams = await familiesOf(eventId)
      expect(fams.find((f) => f.name === 'Garcías')).toBeTruthy()
    })
  })

  it('el alias se propone del nombre y se puede corregir (D3)', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('+ Familia'))

    // Nace vacío y se va escribiendo solo mientras nadie lo toque: el único
    // fallo que rompe la firma de una idea es que se quede vacío.
    await userEvent.type(screen.getByLabelText('Nombre'), 'Pérez')
    expect(screen.getByLabelText('Alias')).toHaveValue('PE')

    // Y en cuanto se corrige, deja de seguir al nombre.
    await userEvent.clear(screen.getByLabelText('Alias'))
    await userEvent.type(screen.getByLabelText('Alias'), 'PZ')
    await userEvent.type(screen.getByLabelText('Nombre'), 'a')
    expect(screen.getByLabelText('Alias')).toHaveValue('PZ')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const familias = await familiesOf(eventId)
      expect(familias.find((f) => f.name === 'Péreza')?.alias).toBe('PZ')
    })
  })

  it('una familia de antes se guarda con el alias que se le propone', async () => {
    const { eventId, garcia } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('García'))

    // No tenía alias —es de antes de que existiera la columna— y la ficha lo
    // enseña ya puesto, no en blanco.
    expect(screen.getByLabelText('Alias')).toHaveValue('GA')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      expect((await familiesOf(eventId)).find((f) => f.id === garcia).alias).toBe('GA')
    })
  })

  it('la pastilla abre la hoja de elección con lo libre y lo tomado (A3)', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('+ Bunga'))
    const hoja = within(await screen.findByRole('dialog'))
    expect(await screen.findByText('¿Qué bunga?')).toBeTruthy()
    // Bunga 1 sale, pero apagado y diciendo de quién es.
    expect(hoja.getByText('lo tienen los García')).toBeTruthy()
    expect(hoja.getByRole('button', { name: /Bunga 1/ }).disabled).toBe(true)
    // Y la salida de N4 está ahí para cuando no quede ninguno libre.
    expect(hoja.getByText('+ Bunga nuevo…')).toBeTruthy()
  })

  it('elegir un bunga libre lo asigna', async () => {
    const { eventId, solteros } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('+ Bunga'))
    const hoja = within(await screen.findByRole('dialog'))
    await userEvent.click(hoja.getByRole('button', { name: /Bunga 3/ }))
    await waitFor(async () => {
      const bungas = await bungasOf(eventId)
      expect(bungas.find((b) => b.name === 'Bunga 3').familyId).toBe(solteros)
    })
  })

  it('crear una persona desde su ficha no pregunta la familia (N2)', async () => {
    const { eventId, garcia } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click((await screen.findAllByText('+ Persona'))[0])
    expect(await screen.findByText('Nueva persona · García')).toBeTruthy()
    expect(screen.queryByText('Familia')).toBe(null)
    await userEvent.type(screen.getByLabelText('Nombre'), 'Marta')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const gente = await personsOf(eventId)
      expect(gente.find((p) => p.name === 'Marta')?.familyId).toBe(garcia)
    })
  })

  it('borrar dice qué se lleva y solo entonces borra (D1)', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByText('García'))
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }))
    expect(await screen.findByText(/Su única persona se queda sin familia y Bunga 1 vuelve a quedar libre/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }))
    await waitFor(async () => {
      expect((await familiesOf(eventId)).some((f) => f.name === 'García')).toBe(false)
    })
    // Y lo que colgaba de ella queda suelto, no apuntando a un fantasma.
    const bungas = await bungasOf(eventId)
    expect(bungas.find((b) => b.name === 'Bunga 1').familyId).toBe(null)
    expect((await personsOf(eventId)).find((p) => p.name === 'Curro').familyId).toBe(null)
  })

  it('la edad son dos botones y el peso sale de ella, sin campo que rellenar', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click((await screen.findAllByText('+ Persona'))[0])
    const hoja = within(await screen.findByRole('dialog'))
    await userEvent.type(hoja.getByLabelText('Nombre'), 'Fran')
    await userEvent.click(hoja.getByRole('button', { name: /Niño/ }))
    expect(hoja.queryByLabelText('Peso de reparto')).toBe(null)
    await userEvent.click(hoja.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      const fran = (await personsOf(eventId)).find((p) => p.name === 'Fran')
      expect(fran?.edad).toBe('niño')
      expect(fran?.pesoReparto).toBe(0.6)
    })
  })

  it('el emoji se puede elegir de la galería, además de escribirlo', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click((await screen.findAllByText('+ Persona'))[0])
    const hoja = within(await screen.findByRole('dialog'))
    await userEvent.type(hoja.getByLabelText('Nombre'), 'Pablo')
    await userEvent.click(hoja.getByRole('button', { name: 'Emoji 🐳' }))
    await userEvent.click(hoja.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => {
      expect((await personsOf(eventId)).find((p) => p.name === 'Pablo')?.avatar).toBe('🐳')
    })
  })

  it('no hay ningún botón de borrar en las filas', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await screen.findByText('García')
    // El verbo solo existe dentro del editor, nunca en el renglón.
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBe(null)
  })
})
