'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claseControl } from '@/components/campo'
import { Button } from '@/components/ui/button'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useGrupos } from '@/lib/catalogos'
import type { FichaTrabajador } from './formulario'

// soloLectura (gerencia y coordinador): ve los grupos del trabajador, sin agregarlo ni quitarlo.
export function GruposTrabajador({ ficha, soloLectura = false }: { ficha: FichaTrabajador; soloLectura?: boolean }) {
  const cliente = useQueryClient()
  const { data: grupos, isPending, error } = useGrupos()
  const trabajadorId = ficha.id

  const opciones = {
    // Devuelve la promesa: la mutación sigue "pendiente" hasta que las listas se refrescan.
    onSuccess: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: ['trabajadores', trabajadorId] }),
        cliente.invalidateQueries({ queryKey: ['grupos'] }),
      ]),
    onError: (e: unknown) => {
      toast.error(mensajeDeError(e))
    },
  }
  const agregar = useMutation({
    mutationFn: (id: string) => leer(api.v1.groups[':id'].members.$post({ param: { id }, json: { workerIds: [trabajadorId] } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (id: string) => leer(api.v1.groups[':id'].members[':workerId'].$delete({ param: { id, workerId: trabajadorId } })),
    ...opciones,
  })

  const ocupado = agregar.isPending || quitar.isPending
  const propios = grupos?.items.filter((g) => ficha.groupIds.includes(g.id)) ?? []
  const disponibles = grupos?.items.filter((g) => g.active && !ficha.groupIds.includes(g.id)) ?? []

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Grupos</h2>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {mensajeDeError(error)}
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {propios.length === 0 && <li className="text-sm text-muted-foreground">No está en ningún grupo.</li>}
            {propios.map((g) => (
              <li key={g.id} className={`flex h-9 items-center gap-1 rounded-full border pl-3 text-sm ${soloLectura ? 'pr-3' : 'pr-1'}`}>
                {g.name}
                {!soloLectura && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Quitar del grupo ${g.name}`}
                    disabled={ocupado}
                    onClick={() => quitar.mutate(g.id)}
                  >
                    ×
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!soloLectura && disponibles.length > 0 && (
            <select
              aria-label="Agregar a un grupo"
              className={`${claseControl} h-10 max-w-xs`}
              value=""
              disabled={ocupado}
              onChange={(e) => e.target.value && agregar.mutate(e.target.value)}
            >
              <option value="">+ Agregar a un grupo</option>
              {disponibles.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </section>
  )
}
