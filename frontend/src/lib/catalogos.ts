'use client'

import { useQuery } from '@tanstack/react-query'
import { api, leer } from './api'

// Catálogos que usan varias pantallas; cambian poco, así que se guardan 5 minutos.
const opciones = { staleTime: 5 * 60_000 }

export const useAreas = () => useQuery({ queryKey: ['areas'], queryFn: () => leer(api.v1.areas.$get()), ...opciones })
export const useCargos = () => useQuery({ queryKey: ['cargos'], queryFn: () => leer(api.v1.cargos.$get()), ...opciones })
export const useTurnos = () => useQuery({ queryKey: ['turnos'], queryFn: () => leer(api.v1.turnos.$get()), ...opciones })
export const useGrupos = () => useQuery({ queryKey: ['grupos'], queryFn: () => leer(api.v1.grupos.$get()), ...opciones })
