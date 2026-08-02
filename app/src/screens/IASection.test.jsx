import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEventBase from '@testing-library/user-event'

/**
 * Ajustes → IA: el modelo se elige de una lista, y la clave se puede probar.
 *
 * El modelo se escribía a mano en una caja de texto. Una errata —o un nombre que
 * Anthropic ha retirado— no se veía al guardar: se veía meses después, cuando
 * alguien pulsaba «¿Qué podríamos hacer?» y no pasaba nada.
 */
const leerIA = vi.fn()
const listarModelosIA = vi.fn()
const probarIA = vi.fn()
const guardarIA = vi.fn()

vi.mock('../sync/api.js', async (original) => ({
  ...(await original()),
  leerIA: (...a) => leerIA(...a),
  listarModelosIA: (...a) => listarModelosIA(...a),
  probarIA: (...a) => probarIA(...a),
  guardarIA: (...a) => guardarIA(...a),
  listarCuentas: vi.fn(async () => ({ cuentas: [] })),
}))

const { IASection } = await import('./CuentasSection.jsx')

let userEvent
beforeEach(() => {
  userEvent = userEventBase.setup()
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('ballena.sesion', JSON.stringify({ token: 't', cuenta: { rol: 'administrador' } }))
  leerIA.mockResolvedValue({ ia: { hayClave: true, cola: 'ab12', guardadaEn: Date.now(), modelo: 'claude-haiku-4-5' } })
  listarModelosIA.mockResolvedValue({
    modelos: [
      { id: 'claude-opus-5', nombre: 'Claude Opus 5' },
      { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5' },
    ],
    modelo: 'claude-haiku-4-5',
    sustituto: null,
  })
})

describe('los modelos', () => {
  it('se traen del servidor y se eligen de una lista, no se teclean', async () => {
    render(<IASection />)

    // La lista llega del servidor, así que se espera a que esté.
    await screen.findByRole('option', { name: 'Claude Opus 5' })
    const select = screen.getByLabelText('Modelo')
    expect(select.tagName).toBe('SELECT')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Claude Opus 5', 'Claude Haiku 4.5'])
    // Y sale elegido el que está guardado.
    expect(select.value).toBe('claude-haiku-4-5')
  })

  it('sin clave no se pregunta: no hay a quién', async () => {
    leerIA.mockResolvedValue({ ia: { hayClave: false, modelo: 'claude-haiku-4-5' } })
    render(<IASection />)

    await screen.findByText(/Sin clave/)
    expect(listarModelosIA).not.toHaveBeenCalled()
    // Y el modelo se sigue pudiendo escribir a mano.
    expect((await screen.findByLabelText('Modelo')).tagName).toBe('INPUT')
  })

  it('si la lista no llega se queda la caja de texto, y se dice por qué', async () => {
    listarModelosIA.mockRejectedValue(new Error('la API respondió 502'))
    render(<IASection />)

    expect((await screen.findByLabelText('Modelo')).tagName).toBe('INPUT')
    expect(screen.getByText(/No se han podido traer los modelos/)).toBeInTheDocument()
  })

  it('un modelo retirado se cambia solo por el más cercano, y se dice cuál', async () => {
    // Es el caso que hay que ver: Anthropic lo retiró, y hasta ahora eso no se
    // notaba aquí sino meses después, cuando alguien pedía sugerencias.
    leerIA.mockResolvedValue({ ia: { hayClave: true, cola: 'ab12', modelo: 'claude-3-5-sonnet' } })
    listarModelosIA.mockResolvedValue({
      modelos: [{ id: 'claude-opus-5', nombre: 'Claude Opus 5' }, { id: 'claude-sonnet-4-5', nombre: 'Claude Sonnet 4.5' }],
      modelo: 'claude-sonnet-4-5',
      sustituto: { antes: 'claude-3-5-sonnet', ahora: 'claude-sonnet-4-5' },
    })
    render(<IASection />)

    expect(await screen.findByText(/claude-3-5-sonnet ya no existe\. Se ha puesto claude-sonnet-4-5/)).toBeInTheDocument()
    expect(screen.getByLabelText('Modelo').value).toBe('claude-sonnet-4-5')
  })

  it('el modelo puesto no desaparece de la lista si nadie propone otro', async () => {
    // Red de seguridad: un desplegable cuyo valor no está entre sus opciones se
    // pinta en blanco y parece que no hay nada elegido.
    leerIA.mockResolvedValue({ ia: { hayClave: true, cola: 'ab12', modelo: 'claude-raro' } })
    listarModelosIA.mockResolvedValue({
      modelos: [{ id: 'claude-opus-5', nombre: 'Claude Opus 5' }],
      modelo: 'claude-raro',
      sustituto: null,
    })
    render(<IASection />)

    await screen.findByText(/el que hay puesto/)
    expect(screen.getByLabelText('Modelo').value).toBe('claude-raro')
  })
})

describe('probar', () => {
  it('dice que funciona, con el modelo y lo que tardó', async () => {
    probarIA.mockResolvedValue({ ok: true, modelo: 'claude-haiku-4-5', ms: 412 })
    render(<IASection />)

    await userEvent.click(await screen.findByRole('button', { name: 'Probar' }))
    expect(await screen.findByText(/Funciona: claude-haiku-4-5 ha contestado en 412 ms/)).toBeInTheDocument()
  })

  it('si el modelo ya no existe no dice «no funciona»: dice por cuál se ha cambiado', async () => {
    probarIA.mockResolvedValue({
      ok: true, modelo: 'claude-sonnet-4-5', ms: 380,
      cambiado: { antes: 'claude-3-5-sonnet', ahora: 'claude-sonnet-4-5' },
    })
    render(<IASection />)

    await userEvent.click(await screen.findByRole('button', { name: 'Probar' }))
    expect(await screen.findByText(/claude-3-5-sonnet ya no existe\. Se ha puesto claude-sonnet-4-5, el más cercano, y ha contestado en 380 ms/))
      .toBeInTheDocument()
  })

  it('cuando no funciona dice qué ha pasado, no «error»', async () => {
    probarIA.mockRejectedValue(new Error('la API respondió 401: invalid x-api-key'))
    render(<IASection />)

    await userEvent.click(await screen.findByRole('button', { name: 'Probar' }))
    expect(await screen.findByText(/No funciona — la API respondió 401: invalid x-api-key/)).toBeInTheDocument()
  })

  it('sin clave no hay nada que probar y el botón no está', async () => {
    leerIA.mockResolvedValue({ ia: { hayClave: false, modelo: '' } })
    render(<IASection />)

    await screen.findByText(/Sin clave/)
    expect(screen.queryByRole('button', { name: 'Probar' })).not.toBeInTheDocument()
  })
})
