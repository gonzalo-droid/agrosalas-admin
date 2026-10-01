'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, claseControl } from '@/components/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import type { FichaTrabajador } from './formulario'

const TIPO = { yape: 'Yape', plin: 'Plin', cuenta_bancaria: 'Cuenta bancaria' } as const
type Tipo = keyof typeof TIPO

export function MetodosPago({ ficha }: { ficha: FichaTrabajador }) {
  const cliente = useQueryClient()
  const [agregando, setAgregando] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('yape')
  const id = ficha.id

  // Devuelve la promesa: la mutación sigue "pendiente" hasta que la lista se refresca.
  const refrescar = () => cliente.invalidateQueries({ queryKey: ['trabajadores', id] })
  const opciones = {
    onSuccess: refrescar,
    onError: (e: unknown) => {
      toast.error(mensajeDeError(e))
    },
  }
  const agregar = useMutation({
    mutationFn: (datos: FormData) => {
      const texto = (campo: string) => String(datos.get(campo) ?? '').trim()
      return leer(
        api.v1.trabajadores[':id']['metodos-pago'].$post({
          param: { id },
          json: {
            tipo,
            numero: texto('numero'),
            titular: texto('titular'),
            banco: texto('banco') || null,
            cci: texto('cci') || null,
          },
        }),
      )
    },
    ...opciones,
    onSuccess: () => {
      setAgregando(false)
      return refrescar()
    },
  })
  const hacerPrincipal = useMutation({
    mutationFn: (metodoId: string) =>
      leer(api.v1.trabajadores[':id']['metodos-pago'][':metodoId'].$patch({ param: { id, metodoId }, json: { principal: true } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (metodoId: string) =>
      leer(api.v1.trabajadores[':id']['metodos-pago'][':metodoId'].$delete({ param: { id, metodoId } })),
    ...opciones,
  })
  const ocupado = quitar.isPending || hacerPrincipal.isPending

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Métodos de pago</h2>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>

      {ficha.metodosPago.length === 0 && <p className="text-sm text-muted-foreground">Aún no tiene métodos de pago.</p>}
      <ul className="space-y-2">
        {ficha.metodosPago.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {TIPO[m.tipo]} · {m.banco ? `${m.banco} ` : ''}
                {m.numero} {m.principal && <Badge variant="secondary">Principal</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.cci ? `CCI ${m.cci} · ` : ''}Titular: {m.titular}
              </p>
            </div>
            {!m.principal && (
              <Button variant="ghost" size="lg" disabled={ocupado} onClick={() => hacerPrincipal.mutate(m.id)}>
                Hacer principal
              </Button>
            )}
            <Button variant="destructive" size="lg" disabled={ocupado} onClick={() => quitar.mutate(m.id)}>
              Quitar
            </Button>
          </li>
        ))}
      </ul>

      {agregando ? (
        <form
          className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            agregar.mutate(new FormData(e.currentTarget))
          }}
        >
          <Campo id="metodo-tipo" etiqueta="Tipo">
            <select id="metodo-tipo" className={`${claseControl} h-10`} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {(Object.keys(TIPO) as Tipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="metodo-numero" etiqueta={tipo === 'cuenta_bancaria' ? 'Número de cuenta' : 'Celular'}>
            <Input id="metodo-numero" name="numero" required minLength={6} className="h-10" />
          </Campo>
          {tipo === 'cuenta_bancaria' && (
            <>
              <Campo id="metodo-banco" etiqueta="Banco">
                <Input id="metodo-banco" name="banco" className="h-10" />
              </Campo>
              <Campo id="metodo-cci" etiqueta="CCI">
                <Input id="metodo-cci" name="cci" className="h-10" />
              </Campo>
            </>
          )}
          <Campo id="metodo-titular" etiqueta="Titular" ayuda="Puede ser otra persona." className="sm:col-span-2">
            <Input id="metodo-titular" name="titular" required minLength={2} defaultValue={`${ficha.nombres} ${ficha.apellidos}`} className="h-10" />
          </Campo>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="lg" disabled={agregar.isPending}>
              Agregar
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setAgregando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="lg" className="w-full border-dashed" onClick={() => setAgregando(true)}>
          + Agregar método de pago (Yape, Plin o cuenta bancaria)
        </Button>
      )}
    </section>
  )
}
