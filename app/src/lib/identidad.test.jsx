import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIdentidad, getMeId } from './identidad.js'
import { guardarSesion } from '../auth/sesion.js'

/**
 * La identidad sembrada desde la cuenta (SPECS §14.41): si el servidor ya sabe
 * con qué persona está enlazada esta cuenta, el móvil no pregunta quién eres.
 */
const PERSONAS = [
  { id: 'per_mariona', name: 'Mariona' },
  { id: 'per_curro', name: 'Curro' },
]

beforeEach(() => {
  localStorage.clear()
})

describe('useIdentidad y la cuenta enlazada', () => {
  it('sin identidad elegida, la persona enlazada de la sesión entra sola', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro', personId: 'per_mariona' } })
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me?.id).toBe('per_mariona'))
    // Y queda guardada como si se hubiera elegido a mano.
    expect(getMeId('evt_1')).toBe('per_mariona')
  })

  it('una elección hecha a mano no se pisa', async () => {
    localStorage.setItem('ballena.me:evt_1', 'per_curro')
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro', personId: 'per_mariona' } })
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me?.id).toBe('per_curro'))
  })

  it('si la persona enlazada no es de este evento, no se inventa nada', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro', personId: 'per_de_otro_evento' } })
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me).toBe(null))
    expect(getMeId('evt_1')).toBe(null)
  })

  it('sin sesión, la sala sigue como estaba: nadie elegido', async () => {
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me).toBe(null))
  })
})
