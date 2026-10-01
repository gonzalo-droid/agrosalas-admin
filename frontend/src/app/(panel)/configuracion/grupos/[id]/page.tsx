'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
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

  const grupo = useQuery({ queryKey: ['grupos', id], queryFn: () => leer(api.v1.grupos[':id'].$get({ param: { id } })) })
  const busqueda = useQuery({
    queryKey: ['trabajadores', 'buscar', textoRetrasado],
    queryFn: () => leer(api.v1.trabajadores.$get({ query: { texto: textoRetrasado, estado: 'activo', tamano: '10' } })),
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
      {grupo.error ? (
        <p role="alert" className="text-sm text-destructive">
          {mensajeDeError(grupo.error)}
        </p>
      ) : !grupo.data ? (
        <h2 className="text-lg font-semibold">Cargando…</h2>
      ) : (
        <>
          <h2 className="text-lg font-semibold">{grupo.data.nombre}</h2>

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
              ) : busqueda.data.datos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ningún trabajador activo coincide.</p>
              ) : (
                <ul className="divide-y">
                  {busqueda.data.datos.map((t) => (
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
              )}
            </div>

            <div className="space-y-2 rounded-xl border bg-background p-4">
              <h3 className="text-sm font-medium">Miembros ({grupo.data.miembros.length})</h3>
              <ul className="flex flex-wrap gap-2">
                {grupo.data.miembros.map((m) => (
                  <li key={m.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
                    {m.apellidos}, {m.nombres}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full"
                      aria-label={`Quitar a ${m.nombres} ${m.apellidos}`}
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
