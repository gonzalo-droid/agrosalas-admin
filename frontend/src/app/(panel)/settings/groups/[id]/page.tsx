'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, errorMessage, unwrap } from '@/lib/api'
import { useDebouncedValue } from '@/lib/debounced-value'

export default function GroupMembersPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')

  // The "at least 2 letters" notice uses what is typed now; the query, the debounced text.
  const canSearch = text.trim().length >= 2
  const debouncedText = useDebouncedValue(text)
  const canSearchDebounced = debouncedText.trim().length >= 2

  const group = useQuery({ queryKey: ['groups', id], queryFn: () => unwrap(api.v1.groups[':id'].$get({ param: { id } })) })
  const search = useQuery({
    queryKey: ['workers', 'search', debouncedText],
    queryFn: () => unwrap(api.v1.workers.$get({ query: { search: debouncedText, status: 'active', pageSize: '10' } })),
    enabled: canSearchDebounced,
    placeholderData: keepPreviousData,
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['groups'] }),
      queryClient.invalidateQueries({ queryKey: ['workers'] }),
    ])
  const add = useMutation({
    mutationFn: (workerId: string) =>
      unwrap(api.v1.groups[':id'].members.$post({ param: { id }, json: { workerIds: [workerId] } })),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (workerId: string) =>
      unwrap(api.v1.groups[':id'].members[':workerId'].$delete({ param: { id, workerId } })),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })

  const isMember = (workerId: string) => group.data?.members.some((m) => m.id === workerId)

  return (
    <section className="space-y-4">
      <Link href="/settings/groups" className="text-sm font-medium text-primary">
        ← Grupos
      </Link>
      {/* If a refresh fails but there is already data, the data keeps being shown. */}
      {group.error && !group.data ? (
        <ErrorWithRetry error={group.error} onRetry={group.refetch} />
      ) : !group.data ? (
        <h2 className="text-lg font-semibold">Cargando…</h2>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{group.data.name}</h2>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border bg-background p-4">
              <label htmlFor="search-member" className="text-sm font-medium">
                Agregar trabajadores
              </label>
              <Input
                id="search-member"
                className="h-10"
                placeholder="Buscar por nombre o DNI"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              {!canSearch ? (
                <p className="text-sm text-muted-foreground">Escribe al menos 2 letras para buscar.</p>
              ) : search.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(search.error)}
                </p>
              ) : !search.data ? (
                <p className="text-sm text-muted-foreground">Buscando…</p>
              ) : search.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún trabajador activo coincide.</p>
              ) : (
                <ul className="divide-y">
                  {search.data.items.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <span>
                        {w.lastName}, {w.firstName}
                      </span>
                      <Button variant="outline" size="lg" disabled={isMember(w.id) || add.isPending} onClick={() => add.mutate(w.id)}>
                        {isMember(w.id) ? 'Ya está' : 'Agregar'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 rounded-xl border bg-background p-4">
              <h3 className="text-sm font-medium">Miembros ({group.data.members.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {group.data.members.map((m) => (
                  <li key={m.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
                    {m.lastName}, {m.firstName}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label={`Quitar a ${m.firstName} ${m.lastName}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(m.id)}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
