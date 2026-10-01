'use client'

import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api'

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.v1.me.$get()), staleTime: 5 * 60_000 })

export const ROLE_LABEL = {
  admin: 'Administrador',
  management: 'Gerencia',
  accounting: 'Contabilidad',
  coordinator: 'Coordinador',
} as const
