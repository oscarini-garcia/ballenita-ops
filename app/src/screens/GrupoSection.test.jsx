import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GrupoSection from './GrupoSection.jsx'
import {
  createEvent, addFamily, addBunga, addPerson, updatePerson,
  familiesOf, bungasOf, personsOf,
} from '../db.js'
import { setMeId } from '../lib/identidad.js'

async function sembrar() {
  const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
  const garcia = await addFamily(eventId, { name: 'García', color: '#E5544B', avatar: '🏖️', estado: 'modo playa' })
  const solteros = await addFamily(eventId, { name: 'Solteros', color: '#1FA6D6', avatar: '🎉' })
  await addBunga(eventId, { name: 'Bunga 1', alias: 'el de la piscina', familyId: garcia })
  await addBunga(eventId, { name: 'Bunga 3', alias: 'el del fondo' })
  await addPerson(eventId, { name: 'Curro', familyId: garcia, edad: 'adulto' })
  return { eventId, garcia, solteros }
}

/**
 * Dentro de la solapa de una familia. Hace falta desde §14.63 porque «Quién
 * eres» vive ahora en esta misma pantalla y su lista de «Cambiar de persona»
 * nombra a todo el mundo: buscar «Curro» suelto encuentra dos.
 */
const enFamilia = async (nombre) => within((await screen.findByText(nombre)).closest('details'))

describe('El grupo — la ficha por familia (G2)', () => {
  it('cada familia es un desplegable que dice quién es y cuántos son', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    // La solapa cerrada tiene que decir lo justo para no abrirla (§14.63). El
    // estado de la familia se retiró en §14.66: lo dice cada persona.
    expect(await screen.findByText('García')).toBeTruthy()
    expect(await screen.findByText('1 persona')).toBeTruthy()
    expect(screen.queryByText(/modo playa/)).toBeNull()
    // Y su gente está dentro, que con `<details>` sigue estando en el documento.
    expect((await enFamilia('García')).getByText('Curro')).toBeTruthy()
  })

  it('quien no tiene familia sale aparte, y los bungas ya no salen aquí', async () => {
    const { eventId } = await sembrar()
    await addPerson(eventId, { name: 'Suelto', edad: 'adulto' })
    render(<GrupoSection eventId={eventId} />)
    expect(await screen.findByText('Sin familia')).toBeTruthy()
    // Los bungas se fueron a su área: aquí no estorban.
    expect(screen.queryByText('Bunga 3')).toBe(null)
  })

  it('los bungas viven en su área, con de quién es cada uno', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} area="bungas" />)
    expect(await screen.findByText('Bunga 1')).toBeTruthy()
    expect(await screen.findByText('Bunga 3')).toBeTruthy()
    // El que no tiene dueño lo dice, no se calla.
    expect(await screen.findByText('— de nadie —')).toBeTruthy()
  })

  it('tocar «Editar» abre el editor de la familia (E1)', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar «García»/ }))
    expect(await screen.findByText('Editar familia')).toBeTruthy()
    expect(screen.getByLabelText('Nombre').value).toBe('García')
  })

  it('editar guarda el cambio en la base', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click(await screen.findByRole('button', { name: /Editar «García»/ }))
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
    await userEvent.click(await screen.findByRole('button', { name: /Editar «García»/ }))

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
    render(<GrupoSection eventId={eventId} area="bungas" />)
    await userEvent.click(await screen.findByText('Darle uno'))
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
    render(<GrupoSection eventId={eventId} area="bungas" />)
    await userEvent.click(await screen.findByText('Darle uno'))
    const hoja = within(await screen.findByRole('dialog'))
    await userEvent.click(hoja.getByRole('button', { name: /Bunga 3/ }))
    await waitFor(async () => {
      const bungas = await bungasOf(eventId)
      expect(bungas.find((b) => b.name === 'Bunga 3').familyId).toBe(solteros)
    })
  })

  // §14.48: un bunga con familia se cae de «Sueltos», que era el único renglón
  // que abría su editor. Su nombre y su mote quedaban escritos para siempre.
  it('la hoja de la pastilla lleva al editor del bunga que ya tiene', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} area="bungas" />)

    // Bunga 1 es de los García; desde §14.63 su fila vive en el área de bungas y
    // **abre su editor directamente**: ya no hace falta pasar por la hoja de
    // elección, que era el único camino cuando el bunga con familia desaparecía
    // de «Sueltos» (§14.48).
    await userEvent.click(await screen.findByText('Bunga 1'))

    expect(await screen.findByText('Editar bunga')).toBeTruthy()
    const nombre = screen.getByLabelText('Nombre')
    expect(nombre).toHaveValue('Bunga 1')
    await userEvent.clear(nombre)
    await userEvent.type(nombre, 'Bunga 7')
    const alias = screen.getByLabelText('Alias (opcional)')
    await userEvent.clear(alias)
    await userEvent.type(alias, 'el de la barbacoa')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const b = (await bungasOf(eventId)).find((x) => x.name === 'Bunga 7')
      expect(b?.alias).toBe('el de la barbacoa')
      // Y sigue siendo de los García: corregir sus datos no lo desasigna.
      expect(b?.familyId).toBe((await familiesOf(eventId)).find((f) => f.name === 'García').id)
    })
  })

  it('una familia sin bunga no ofrece editar ninguno, solo crearlo', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} area="bungas" />)
    await userEvent.click(await screen.findByText('Darle uno'))
    const hoja = within(await screen.findByRole('dialog'))
    expect(hoja.getByText('+ Bunga nuevo…')).toBeTruthy()
    expect(hoja.queryByRole('button', { name: /^Editar / })).toBe(null)
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
    await userEvent.click(await screen.findByRole('button', { name: /Editar «García»/ }))
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

  // §14.47: el campo contaba unidades UTF-16 (`maxLength={4}`), así que dejaba
  // dos caritas y **ninguna familia** —👨‍👩‍👧 son ocho—. Ahora cuenta dibujos.
  it('en el emoji de una persona caben tres dibujos, y el cuarto no', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click((await screen.findAllByText('+ Persona'))[0])
    const hoja = within(await screen.findByRole('dialog'))

    await userEvent.type(hoja.getByLabelText('Nombre'), 'Teo')
    const emoji = hoja.getByLabelText('Emoji')
    await userEvent.clear(emoji)
    await userEvent.paste('🐳🦑🦀🏄')
    await userEvent.click(hoja.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      expect((await personsOf(eventId)).find((p) => p.name === 'Teo')?.avatar).toBe('🐳🦑🦀')
    })
  })

  it('y una familia entera cabe, que antes no cabía ninguna', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await userEvent.click((await screen.findAllByText('+ Persona'))[0])
    const hoja = within(await screen.findByRole('dialog'))

    await userEvent.type(hoja.getByLabelText('Nombre'), 'Ana')
    const emoji = hoja.getByLabelText('Emoji')
    await userEvent.clear(emoji)
    await userEvent.paste('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}')
    await userEvent.click(hoja.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const ana = (await personsOf(eventId)).find((p) => p.name === 'Ana')
      expect(ana?.avatar).toBe('\u{1F468}\u200D\u{1F469}\u200D\u{1F467}')
    })
  })

  it('la casilla del avatar dice cuántos dibujos lleva, para encogerlos', async () => {
    const eventId = await createEvent({ name: 'Ballenita', currency: 'EUR' })
    await addFamily(eventId, { name: 'García', color: '#E5544B', avatar: '🐳🦑🦀' })
    const { container } = render(<GrupoSection eventId={eventId} />)
    await screen.findByText('García')

    // Acotado a la solapa: el primer `.av` del documento es el de «Quién eres».
    expect(container.querySelector('.acordeon summary .av')?.dataset.emojis).toBe('3')
  })

  it('no hay ningún botón de borrar en las filas', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} />)
    await screen.findByText('García')
    // El verbo solo existe dentro del editor, nunca en el renglón.
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBe(null)
  })
})

describe('quién lleva las cuentas (§14.58)', () => {
  it('quien administra la marca en la ficha, y se guarda', async () => {
    const { eventId } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    render(<GrupoSection eventId={eventId} />)

    await userEvent.click((await enFamilia('García')).getByText('Curro'))
    await userEvent.click(await screen.findByRole('switch', { name: /Lleva las cuentas/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const gente = await personsOf(eventId)
      expect(gente.find((p) => p.name === 'Curro').llevaLasCuentas).toBe(true)
    })
  })

  it('a un niño no se le ofrece: sería una casilla que no puede hacer nada', async () => {
    const { eventId, garcia } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    await addPerson(eventId, { name: 'Fran', edad: 'niño', familyId: garcia })
    render(<GrupoSection eventId={eventId} />)

    await userEvent.click((await enFamilia('García')).getByText('Fran'))
    expect(screen.queryByRole('switch', { name: /Lleva las cuentas/ })).not.toBeInTheDocument()
    // Y al adulto sí.
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await userEvent.click((await enFamilia('García')).getByText('Curro'))
    expect(await screen.findByRole('switch', { name: /Lleva las cuentas/ })).toBeInTheDocument()
  })

  it('pasar a niño a quien la llevaba la apaga en el mismo gesto', async () => {
    const { eventId } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    const gente0 = await personsOf(eventId)
    await updatePerson(gente0.find((p) => p.name === 'Curro').id, { llevaLasCuentas: true })
    render(<GrupoSection eventId={eventId} />)

    await userEvent.click((await enFamilia('García')).getByText('Curro'))
    await userEvent.click(await screen.findByRole('button', { name: 'Niño' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const gente = await personsOf(eventId)
      // Sin esto quedaría una fila marcada que la pantalla ya no enseña, y
      // seguiría recibiendo avisos que nadie sabría de dónde salen.
      expect(gente.find((p) => p.name === 'Curro').llevaLasCuentas).toBe(false)
    })
  })
  // §14.65: la ficha de una familia se quedó sin su bunga al partir Grupo en
  // áreas, y dónde duerme cada casa es media pregunta de esta pantalla.
  it('la ficha de la familia dice su bunga por su nombre, y lleva a su pantalla', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} area="familias" />)

    const suyo = await screen.findByRole('button', { name: /Bunga 1/ })
    // El nombre manda; el mote va debajo, que es donde no compite con el número.
    expect(suyo).toHaveTextContent('Bunga 1')
    expect(suyo).toHaveTextContent('el de la piscina')

    await userEvent.click(suyo)
    expect(await screen.findByText('Editar bunga')).toBeTruthy()
  })

  it('una familia sin bunga lo dice, y el renglón abre la hoja de elegir', async () => {
    const { eventId } = await sembrar()
    render(<GrupoSection eventId={eventId} area="familias" />)

    await userEvent.click(await screen.findByRole('button', { name: /Sin bunga/ }))
    expect(await screen.findByText('¿Qué bunga?')).toBeTruthy()
  })
})

/**
 * **Quien se va unos días** (SPECS §14.78).
 *
 * La única forma de quitar a alguien del reparto era borrarlo, y borrar se lleva
 * por delante todo lo que ya había apuntado a su nombre. El interruptor lo deja
 * en su casa y en su sitio, sin contar.
 */
describe('se ha ido unos días (§14.78)', () => {
  it('el interruptor lo guarda, y la fila lo dice sin esconderlo', async () => {
    const { eventId } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    render(<GrupoSection eventId={eventId} />)

    await userEvent.click((await enFamilia('García')).getByText('Curro'))
    await userEvent.click(await screen.findByRole('switch', { name: /Se ha ido unos días/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => {
      const gente = await personsOf(eventId)
      expect(gente.find((p) => p.name === 'Curro').ausente).toBe(1)
    })
    // Sigue en su familia: se aparta, no se esconde.
    const garcia = await enFamilia('García')
    expect(garcia.getByText('Curro')).toBeInTheDocument()
    expect(garcia.getByText(/fuera · adulto/)).toBeInTheDocument()
  })

  it('el recuento de la familia cuenta a los que están y dice cuántos faltan', async () => {
    const { eventId, garcia } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    await addPerson(eventId, { name: 'Ana', familyId: garcia, edad: 'adulto' })
    render(<GrupoSection eventId={eventId} />)

    // Los dos están.
    expect(await screen.findByText('2 personas')).toBeInTheDocument()

    await userEvent.click((await enFamilia('García')).getByText('Ana'))
    await userEvent.click(await screen.findByRole('switch', { name: /Se ha ido unos días/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    // «2 personas» de una casa donde una se ha vuelto es el número con el que
    // nadie hace la compra.
    expect(await screen.findByText('1 persona · 1 fuera')).toBeInTheDocument()
  })

  it('en «Nueva persona» no se pregunta: todavía no tiene sentido', async () => {
    const { eventId } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    render(<GrupoSection eventId={eventId} />)

    await userEvent.click((await enFamilia('García')).getByRole('button', { name: '+ Persona' }))
    await screen.findByRole('heading', { name: /Nueva persona/ })
    expect(screen.queryByRole('switch', { name: /Se ha ido unos días/ })).not.toBeInTheDocument()
  })
})

/**
 * **Toda la casa, y cualquier adulto** (SPECS §14.79).
 *
 * Dos cosas que faltaban en §14.78: marcar la casa entera de una vez —una familia
 * que se vuelve el miércoles son cinco interruptores— y que lo pueda hacer
 * **cualquier adulto**, porque quién está hoy en el camping es un hecho del
 * viaje del que cuelgan la compra y el reparto, no un dato privado de una casa.
 */
describe('toda la casa se va, y lo marca cualquier adulto (§14.79)', () => {
  // Con sesión de miembro los cerrojos están puestos, y la identidad es una
  // persona de verdad: `useIdentidad` guarda un id, no una ficha.
  // **Se espera a la gente, no a la casa.** `enFamilia` resuelve en cuanto está
  // el nombre de la familia, y sus filas las trae `useLiveQuery` un tick después:
  // con `getByRole` la prueba fallaba una vez de cada muchas, que es la peor
  // clase de prueba que hay. `findBy*` reintenta.
  const soy = async (eventId, campos) => {
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'miembro' } }))
    setMeId(eventId, await addPerson(eventId, campos))
  }

  it('el botón de la casa se los lleva a todos, y la siguiente los trae', async () => {
    const { eventId, garcia } = await sembrar()
    localStorage.setItem('ballena.sesion', JSON.stringify({ cuenta: { rol: 'administrador' } }))
    await addPerson(eventId, { name: 'Ana', familyId: garcia, edad: 'adulto' })
    render(<GrupoSection eventId={eventId} />)

    const casa = async () => (await enFamilia('García')).findByRole('button', { name: /toda la casa/ })
    expect(await casa()).toHaveTextContent('Se han ido unos días')

    await userEvent.click(await casa())
    await waitFor(async () => {
      const gente = (await personsOf(eventId)).filter((p) => p.familyId === garcia)
      expect(gente.every((p) => p.ausente === 1)).toBe(true)
    })
    // Con la casa vacía el botón cambia de verbo: el estado a medias tiene
    // salida por los dos lados.
    await waitFor(async () => expect(await casa()).toHaveTextContent('Han vuelto'))

    await userEvent.click(await casa())
    await waitFor(async () => {
      const gente = (await personsOf(eventId)).filter((p) => p.familyId === garcia)
      expect(gente.every((p) => !p.ausente)).toBe(true)
    })
  })

  it('un adulto de otra casa marca a quien quiera, pero no le abre la ficha', async () => {
    const { eventId, solteros } = await sembrar()
    await soy(eventId, { name: 'Pablo', familyId: solteros, edad: 'adulto' })
    render(<GrupoSection eventId={eventId} />)

    const garcia = await enFamilia('García')
    // La casilla de Curro sí, aunque sea de los García.
    await userEvent.click(await garcia.findByRole('button', { name: /Marcar que Curro se ha ido/ }))
    await waitFor(async () => {
      const gente = await personsOf(eventId)
      expect(gente.find((p) => p.name === 'Curro').ausente).toBe(1)
    })
    // Su ficha no: eso sigue siendo de su casa (§14.63). Se busca por el nombre
    // de la fila y no por rol, que la casilla también se llama «Curro».
    expect((await garcia.findByText('Curro')).closest('button')).toBeDisabled()
  })

  it('un adolescente no marca a nadie', async () => {
    const { eventId, garcia } = await sembrar()
    await soy(eventId, { name: 'Fran', familyId: garcia, edad: 'adolescente' })
    render(<GrupoSection eventId={eventId} />)

    const enCasa = await enFamilia('García')
    expect(await enCasa.findByRole('button', { name: /Marcar que Curro se ha ido/ })).toBeDisabled()
    expect(await enCasa.findByRole('button', { name: /toda la casa/ })).toBeDisabled()
  })
})
