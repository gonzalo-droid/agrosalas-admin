'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { controlClass } from '@/components/field'
import { Button } from '@/components/ui/button'
import { api, errorMessage, unwrap } from '@/lib/api'
import { useGroups } from '@/lib/catalogs'
import type { WorkerRecord } from './worker-form'

// readOnly (management and coordinator): sees the worker's groups, without adding or removing them.
export function WorkerGroups({ worker, readOnly = false }: { worker: WorkerRecord; readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const { data: groups, isPending, error } = useGroups()
  const workerId = worker.id

  const options = {
    // Returns the promise: the mutation stays "pending" until the lists are refreshed.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workers', workerId] }),
        queryClient.invalidateQueries({ queryKey: ['groups'] }),
      ]),
    onError: (e: unknown) => {
      toast.error(errorMessage(e))
    },
  }
  const add = useMutation({
    mutationFn: (id: string) => unwrap(api.v1.groups[':id'].members.$post({ param: { id }, json: { workerIds: [workerId] } })),
    ...options,
  })
  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.v1.groups[':id'].members[':workerId'].$delete({ param: { id, workerId } })),
    ...options,
  })

  const busy = add.isPending || remove.isPending
  const own = groups?.items.filter((g) => worker.groupIds.includes(g.id)) ?? []
  const available = groups?.items.filter((g) => g.active && !worker.groupIds.includes(g.id)) ?? []

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Grupos</h2>
      {isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(error)}
        </p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-2">
            {own.length === 0 && <li className="text-sm text-muted-foreground">No está en ningún grupo.</li>}
            {own.map((g) => (
              <li key={g.id} className={`flex h-9 items-center gap-1 rounded-full border pl-3 text-sm ${readOnly ? 'pr-3' : 'pr-1'}`}>
                {g.name}
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`Quitar del grupo ${g.name}`}
                    disabled={busy}
                    onClick={() => remove.mutate(g.id)}
                  >
                    ×
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && available.length > 0 && (
            <select
              aria-label="Agregar a un grupo"
              className={`${controlClass} h-10 max-w-xs`}
              value=""
              disabled={busy}
              onChange={(e) => e.target.value && add.mutate(e.target.value)}
            >
              <option value="">+ Agregar a un grupo</option>
              {available.map((g) => (
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
