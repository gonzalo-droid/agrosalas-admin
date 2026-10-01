'use client'

import { useQuery } from '@tanstack/react-query'
import { api, leer } from './api'

export const useYo = () => useQuery({ queryKey: ['yo'], queryFn: () => leer(api.v1.me.$get()), staleTime: 5 * 60_000 })

export const ETIQUETA_ROL = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  contabilidad: 'Contabilidad',
  coordinador: 'Coordinador',
} as const
