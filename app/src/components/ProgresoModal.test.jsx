import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProgresoModal, { ListaDePasos } from './ProgresoModal.jsx'

const estados = () => screen.getAllByRole('listitem').map((li) => li.dataset.estado)

describe('ProgresoModal', () => {
  it('enseña bien la versión en curso cuando se le pasa', () => {
    render(<ProgresoModal titulo="Buscando la última versión" version="0.2.0" pasos={[]} />)
    expect(screen.getByText('v0.2.0')).toBeInTheDocument()
    expect(screen.getByText('Versión en curso')).toBeInTheDocument()
  })

  it('sin versión no pinta la caja: sincronizar datos no va de versiones', () => {
    render(<ProgresoModal titulo="Sincronizando todo" pasos={[]} />)
    expect(screen.queryByText('Versión en curso')).not.toBeInTheDocument()
  })

  it('marca cada paso con su estado y su señal', () => {
    render(
      <ProgresoModal
        titulo="Sincronizando todo"
        pasos={[
          { texto: 'Datos al día', estado: 'hecho' },
          { texto: 'No se ha podido', estado: 'fallo' },
          { texto: 'Buscando…', estado: 'curso' },
          { texto: 'Solo local', estado: 'aviso' },
        ]}
      />,
    )
    expect(estados()).toEqual(['hecho', 'fallo', 'curso', 'aviso'])
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('mientras trabaja no hay salida dibujada; al terminar sí', async () => {
    const onCerrar = vi.fn()
    const { rerender } = render(
      <ProgresoModal titulo="Sincronizando todo" pasos={[{ texto: 'Yendo…', estado: 'curso' }]} onCerrar={onCerrar} />,
    )
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()

    rerender(
      <ProgresoModal titulo="Sincronización terminada" pasos={[{ texto: 'Listo', estado: 'hecho' }]} terminado onCerrar={onCerrar} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalled()
  })

  it('bloquea el scroll del fondo mientras está abierto', () => {
    const { unmount } = render(<ProgresoModal titulo="Sincronizando todo" pasos={[]} />)
    expect(document.body.style.position).toBe('fixed')
    unmount()
    expect(document.body.style.position).toBe('')
  })
})

describe('ListaDePasos', () => {
  // La lista suelta es la que Ajustes pinta en su sitio, sin ventana encima.
  it('un paso con informe se toca y se lo lleva al portapapeles', async () => {
    const escribir = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    const onCopiado = vi.fn()

    render(
      <ListaDePasos
        pasos={[
          { texto: 'Datos al día', estado: 'hecho' },
          { texto: 'No se ha podido', estado: 'fallo', informe: 'Ballena Ops v0.4.2\nEstado HTTP: 500' },
        ]}
        onCopiado={onCopiado}
      />,
    )

    await userEvent.click(screen.getByText('No se ha podido'))
    expect(escribir).toHaveBeenCalledWith('Ballena Ops v0.4.2\nEstado HTTP: 500')
    expect(onCopiado).toHaveBeenCalledWith('Copiado')
  })

  it('un paso sin informe no se marca como copiable ni reacciona al toque', async () => {
    const escribir = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })

    render(<ListaDePasos pasos={[{ texto: 'Datos al día', estado: 'hecho' }]} />)
    const fila = screen.getByRole('listitem')
    expect(fila.dataset.copiable).toBeUndefined()

    await userEvent.click(fila)
    expect(escribir).not.toHaveBeenCalled()
  })
})
