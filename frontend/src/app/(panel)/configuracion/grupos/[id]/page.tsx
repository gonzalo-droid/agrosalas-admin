'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ErrorConReintento } from '@/components/error-con-reintento'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useValorRetrasado } from '@/lib/valor-retrasado'

export default function PaginaMiembrosGrupo() {
  const { id } = useParams<{ id: string }>()
  const cliente = useQueryClient()
  const [texto, setTexto] = useState('')

  // El aviso de "al menos 2 letras" usa lo escrito ahora; la consulta, el texto retrasado.
  const puedeBuscar = texto.trim().length >= 2
  const textoRetrasado = useValorRetrasado(texto)
  const puedeBuscarRetrasado = textoRetrasado.trim().length >= 2

  const grupo = useQuery({ queryKey: ['grupos', id], queryFn: () => leer(api.v1.groups[':id'].$get({ param: { id } })) })
  const busqueda = useQuery({
    queryKey: ['trabajadores', 'buscar', textoRetrasado],
    queryFn: () => leer(api.v1.workers.$get({ query: { search: textoRetrasado, status: 'active', pageSize: '10' } })),
    enabled: puedeBuscarRetrasado,
    placeholderData: keepPreviousData,
  })

  const refrescar = () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ['grupos'] }),
      cliente.invalidateQueries({ queryKey: ['trabajadores'] }),
    ])
  const agregar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.groups[':id'].members.$post({ param: { id }, json: { workerIds: [trabajadorId] } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })
  const quitar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.groups[':id'].members[':workerId'].$delete({ param: { id, workerId: trabajadorId } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  const yaEsta = (trabajadorId: string) => grupo.data?.members.some((m) => m.id === trabajadorId)

  return (
    <section className="space-y-4">
      <Link href="/configuracion/grupos" className="text-sm font-medium text-primary">
        ← Grupos
      </Link>
      {/* Si un refresco falla pero ya hay datos, se siguen mostrando los datos. */}
      {grupo.error && !grupo.data ? (
        <ErrorConReintento error={grupo.error} alReintentar={grupo.refetch} />
      ) : !grupo.data ? (
        <h2 className="text-lg font-semibold">Cargando…</h2>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{grupo.data.name}</h2>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border bg-background p-4">
              <label htmlFor="buscar-miembro" className="text-sm font-medium">
                Agregar trabajadores
              </label>
              <Input
                id="buscar-miembro"
                className="h-10"
                placeholder="Buscar por nombre o DNI"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
              {!puedeBuscar ? (
                <p className="text-sm text-muted-foreground">Escribe al menos 2 letras para buscar.</p>
              ) : busqueda.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {mensajeDeError(busqueda.error)}
                </p>
              ) : !busqueda.data ? (
                <p className="text-sm text-muted-foreground">Buscando…</p>
              ) : busqueda.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún trabajador activo coincide.</p>
              ) : (
                <ul className="divide-y">
                  {busqueda.data.items.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                      <span>
                        {t.lastName}, {t.firstName}
                      </span>
                      <Button variant="outline" size="lg" disabled={yaEsta(t.id) || agregar.isPending} onClick={() => agregar.mutate(t.id)}>
                        {yaEsta(t.id) ? 'Ya está' : 'Agregar'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2 rounded-xl border bg-background p-4">
              <h3 className="text-sm font-medium">Miembros ({grupo.data.members.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {grupo.data.members.map((m) => (
                  <li key={m.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
                    {m.lastName}, {m.firstName}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label={`Quitar a ${m.firstName} ${m.lastName}`}
                      disabled={quitar.isPending}
                      onClick={() => quitar.mutate(m.id)}
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
