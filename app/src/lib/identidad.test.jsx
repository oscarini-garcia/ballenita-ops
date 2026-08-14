import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIdentidad, getMeId } from './identidad.js'
import { guardarSesion } from '../auth/sesion.js'

/**
 * La identidad la manda la cuenta (SPECS §14.41 y §14.42): si el servidor sabe
 * con qué persona está enlazada, el móvil no pregunta quién eres **ni deja
 * elegirlo**. Sin sesión —libreta local, demostración— se elige aquí.
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

  // Cambió a propósito (§14.42): antes solo rellenaba el hueco. Con la lista
  // escondida, respetar una elección vieja dejaría atrapado para siempre a
  // quien se hubiera elegido mal — que es justo a quien esto viene a corregir.
  it('una elección vieja de este móvil se corrige: manda la cuenta', async () => {
    localStorage.setItem('ballena.me:evt_1', 'per_curro')
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro', personId: 'per_mariona' } })
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me?.id).toBe('per_mariona'))
    expect(result.current.deLaCuenta).toBe(true)
  })

  it('sin sesión la elección es de este móvil, y no la manda nadie', async () => {
    localStorage.setItem('ballena.me:evt_1', 'per_curro')
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me?.id).toBe('per_curro'))
    expect(result.current.deLaCuenta).toBe(false)
  })

  it('si la persona enlazada no es de este evento, no se inventa nada', async () => {
    guardarSesion({ token: 'jwt', cuenta: { id: 'cta_1', rol: 'miembro', personId: 'per_de_otro_evento' } })
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me).toBe(null))
    expect(getMeId('evt_1')).toBe(null)
    // Y por eso aquí sí hay lista: es la única salida de un evento donde tu
    // cuenta no figura (§14.42).
    expect(result.current.deLaCuenta).toBe(false)
  })

  it('sin sesión, la sala sigue como estaba: nadie elegido', async () => {
    const { result } = renderHook(() => useIdentidad('evt_1', PERSONAS))
    await waitFor(() => expect(result.current.me).toBe(null))
  })
})
