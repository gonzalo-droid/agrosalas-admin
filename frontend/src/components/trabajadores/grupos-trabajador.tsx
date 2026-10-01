'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claseControl } from '@/components/campo'
import { Button } from '@/components/ui/button'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useGrupos } from '@/lib/catalogos'
import type { FichaTrabajador } from './formulario'

export function GruposTrabajador({ ficha }: { ficha: FichaTrabajador }) {
  const cliente = useQueryClient()
  const { data: grupos } = useGrupos()
  const trabajadorId = ficha.id

  const opciones = {
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['trabajadores', trabajadorId] })
      cliente.invalidateQueries({ queryKey: ['grupos'] })
    },
    onError: (e: unknown) => {
      toast.error(mensajeDeError(e))
    },
  }
  const agregar = useMutation({
    mutationFn: (id: string) => leer(api.v1.grupos[':id'].miembros.$post({ param: { id }, json: { trabajadorIds: [trabajadorId] } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (id: string) => leer(api.v1.grupos[':id'].miembros[':trabajadorId'].$delete({ param: { id, trabajadorId } })),
    ...opciones,
  })

  const propios = grupos?.datos.filter((g) => ficha.grupoIds.includes(g.id)) ?? []
  const disponibles = grupos?.datos.filter((g) => g.activo && !ficha.grupoIds.includes(g.id)) ?? []

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Grupos</h2>
      <ul className="flex flex-wrap gap-2">
        {propios.length === 0 && <li className="text-sm text-muted-foreground">No está en ningún grupo.</li>}
        {propios.map((g) => (
          <li key={g.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
            {g.nombre}
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Quitar del grupo ${g.nombre}`} onClick={() => quitar.mutate(g.id)}>
              ×
            </Button>
          </li>
        ))}
      </ul>
      {disponibles.length > 0 && (
        <select
          aria-label="Agregar a un grupo"
          className={`${claseControl} h-10 max-w-xs`}
          value=""
          onChange={(e) => e.target.value && agregar.mutate(e.target.value)}
        >
          <option value="">+ Agregar a un grupo</option>
          {disponibles.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      )}
    </section>
  )
}
