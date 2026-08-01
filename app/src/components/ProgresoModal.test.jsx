import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProgresoModal from './ProgresoModal.jsx'

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
