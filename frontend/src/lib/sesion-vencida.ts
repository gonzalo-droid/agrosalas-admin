import { ErrorApiCliente } from './api'

// La API respondió 401: la sesión ya no vale (venció, se revocó o la cuenta se desactivó).
export const esSesionVencida = (error: unknown) => error instanceof ErrorApiCliente && error.codigo === 'no_autenticado'

// Devuelve una función que responde true como mucho una vez cada `intervaloMs`.
// Sirve para que varias consultas que fallan juntas cierren la sesión una sola vez, y para que
// no se entre en un bucle si, tras salir, el navegador vuelve al panel con la misma sesión inválida.
export function crearLimitador(intervaloMs: number, ahora: () => number = Date.now) {
  let ultima = -Infinity
  return () => {
    const t = ahora()
    if (t - ultima < intervaloMs) return false
    ultima = t
    return true
  }
}
