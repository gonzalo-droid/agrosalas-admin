'use client'

import { useQuery } from '@tanstack/react-query'
import { api, unwrap } from './api'

// Catalogs used by several screens; they change little, so they are kept for 5 minutes.
const options = { staleTime: 5 * 60_000 }

export const useAreas = () => useQuery({ queryKey: ['areas'], queryFn: () => unwrap(api.v1.areas.$get()), ...options })
export const usePositions = () => useQuery({ queryKey: ['positions'], queryFn: () => unwrap(api.v1.positions.$get()), ...options })
export const useShifts = () => useQuery({ queryKey: ['shifts'], queryFn: () => unwrap(api.v1.shifts.$get()), ...options })
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => unwrap(api.v1.groups.$get()), ...options })
