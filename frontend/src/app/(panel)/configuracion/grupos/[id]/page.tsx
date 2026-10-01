'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'

export default function PaginaMiembrosGrupo() {
  const { id } = useParams<{ id: string }>()
  const cliente = useQueryClient()
  const [texto, setTexto] = useState('')

  const grupo = useQuery({ queryKey: ['grupos', id], queryFn: () => leer(api.v1.grupos[':id'].$get({ param: { id } })) })
  const busqueda = useQuery({
    queryKey: ['trabajadores', 'buscar', texto],
    queryFn: () => leer(api.v1.trabajadores.$get({ query: { texto, estado: 'activo', tamano: '10' } })),
    enabled: texto.trim().length >= 2,
  })

  const refrescar = () => {
    cliente.invalidateQueries({ queryKey: ['grupos'] })
  }
  const agregar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.grupos[':id'].miembros.$post({ param: { id }, json: { trabajadorIds: [trabajadorId] } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })
  const quitar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.grupos[':id'].miembros[':trabajadorId'].$delete({ param: { id, trabajadorId } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  const yaEsta = (trabajadorId: string) => grupo.data?.miembros.some((m) => m.id === trabajadorId)

  return (
    <section className="space-y-4">
      <Link href="/configuracion/grupos" className="text-sm font-medium text-primary">
        ← Grupos
      </Link>
      <h2 className="text-lg font-semibold">{grupo.data?.nombre ?? 'Cargando…'}</h2>

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
          <ul className="divide-y">
            {busqueda.data?.datos.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>
                  {t.apellidos}, {t.nombres}
                </span>
                <Button variant="outline" size="lg" disabled={yaEsta(t.id) || agregar.isPending} onClick={() => agregar.mutate(t.id)}>
                  {yaEsta(t.id) ? 'Ya está' : 'Agregar'}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-xl border bg-background p-4">
          <h3 className="text-sm font-medium">Miembros ({grupo.data?.miembros.length ?? 0})</h3>
          <ul className="flex flex-wrap gap-2">
            {grupo.data?.miembros.map((m) => (
              <li key={m.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
                {m.apellidos}, {m.nombres}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={`Quitar a ${m.nombres} ${m.apellidos}`}
                  onClick={() => quitar.mutate(m.id)}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
