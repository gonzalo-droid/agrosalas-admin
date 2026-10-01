import { describe, expect, it, vi } from 'vitest'
import { ErrorApiCliente } from './api'
import { crearClienteConsultas } from './cliente-consultas'

const vencida = () => new ErrorApiCliente({ codigo: 'no_autenticado', mensaje: 'Inicia sesión para continuar' })
const prohibida = () => new ErrorApiCliente({ codigo: 'sin_permiso', mensaje: 'No tienes permiso' })

describe('crearClienteConsultas', () => {
  it('avisa cuando una consulta falla por sesión vencida', async () => {
    const alVencerse = vi.fn()
    const cliente = crearClienteConsultas(alVencerse)
    await cliente.fetchQuery({ queryKey: ['yo'], queryFn: () => Promise.reject(vencida()) }).catch(() => {})
    expect(alVencerse).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando una mutación falla por sesión vencida', async () => {
    const alVencerse = vi.fn()
    const cliente = crearClienteConsultas(alVencerse)
    const mutacion = cliente.getMutationCache().build(cliente, { mutationFn: () => Promise.reject(vencida()) })
    await mutacion.execute(undefined).catch(() => {})
    expect(alVencerse).toHaveBeenCalledTimes(1)
  })

  it('no avisa por otros errores', async () => {
    const alVencerse = vi.fn()
    const cliente = crearClienteConsultas(alVencerse)
    await cliente.fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(prohibida()) }).catch(() => {})
    expect(alVencerse).not.toHaveBeenCalled()
  })

  it('solo reintenta las consultas que fallaron por falta de conexión', () => {
    const reintentar = crearClienteConsultas(() => {}).getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean
    expect(reintentar(0, new ErrorApiCliente({ codigo: 'sin_conexion', mensaje: 'x' }))).toBe(true)
    expect(reintentar(1, new ErrorApiCliente({ codigo: 'sin_conexion', mensaje: 'x' }))).toBe(false)
    expect(reintentar(0, vencida())).toBe(false)
  })
})
