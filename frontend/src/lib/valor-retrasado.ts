'use client'

import { useEffect, useState } from 'react'

// Devuelve `valor` con un retraso de `ms`: sirve para no mandar una petición
// al API por cada tecla que se escribe en un buscador.
export function useValorRetrasado<T>(valor: T, ms = 300): T {
  const [retrasado, setRetrasado] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), ms)
    return () => clearTimeout(temporizador)
  }, [valor, ms])

  return retrasado
}
