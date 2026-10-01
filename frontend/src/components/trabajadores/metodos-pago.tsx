'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, claseControl } from '@/components/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import { descripcionMetodo, TIPO_METODO as TIPO, type TipoMetodo as Tipo } from '@/lib/trabajador-vista'
import type { FichaTrabajador } from './formulario'

// soloLectura (gerencia): ve los métodos de pago, sin agregar, quitar ni cambiar el principal.
export function MetodosPago({ ficha, soloLectura = false }: { ficha: FichaTrabajador; soloLectura?: boolean }) {
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
        api.v1.workers[':id']['payment-methods'].$post({
          param: { id },
          json: {
            type: tipo,
            number: texto('number'),
            holderName: texto('holderName'),
            bank: texto('bank') || null,
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
      leer(api.v1.workers[':id']['payment-methods'][':methodId'].$patch({ param: { id, methodId: metodoId }, json: { isPrimary: true } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (metodoId: string) =>
      leer(api.v1.workers[':id']['payment-methods'][':methodId'].$delete({ param: { id, methodId: metodoId } })),
    ...opciones,
  })
  const ocupado = quitar.isPending || hacerPrincipal.isPending || agregar.isPending

  function confirmarQuitar(metodo: (typeof ficha.paymentMethods)[number]) {
    if (window.confirm(`¿Quitar ${descripcionMetodo(metodo)}? Se borrarán sus datos.`)) quitar.mutate(metodo.id)
  }

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Métodos de pago</h2>
        {!soloLectura && <span className="text-xs text-muted-foreground">Opcional</span>}
      </div>

      {ficha.paymentMethods.length === 0 && <p className="text-sm text-muted-foreground">Aún no tiene métodos de pago.</p>}
      <ul className="space-y-2">
        {ficha.paymentMethods.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {TIPO[m.type]} · {m.bank ? `${m.bank} ` : ''}
                {m.number} {m.isPrimary && <Badge variant="secondary">Principal</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.cci ? `CCI ${m.cci} · ` : ''}Titular: {m.holderName}
              </p>
            </div>
            {!soloLectura && !m.isPrimary && (
              <Button
                variant="ghost"
                size="lg"
                aria-label={`Hacer principal ${descripcionMetodo(m)}`}
                disabled={ocupado}
                onClick={() => hacerPrincipal.mutate(m.id)}
              >
                Hacer principal
              </Button>
            )}
            {!soloLectura && (
              <Button variant="destructive" size="lg" aria-label={`Quitar ${descripcionMetodo(m)}`} disabled={ocupado} onClick={() => confirmarQuitar(m)}>
                Quitar
              </Button>
            )}
          </li>
        ))}
      </ul>

      {soloLectura ? null : agregando ? (
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
          <Campo id="metodo-numero" etiqueta={tipo === 'bank_account' ? 'Número de cuenta' : 'Celular'}>
            <Input
              id="metodo-numero"
              name="number"
              required
              minLength={6}
              maxLength={30}
              inputMode={tipo === 'bank_account' ? undefined : 'numeric'}
              className="h-10"
            />
          </Campo>
          {tipo === 'bank_account' && (
            <>
              <Campo id="metodo-banco" etiqueta="Banco">
                <Input id="metodo-banco" name="bank" maxLength={40} className="h-10" />
              </Campo>
              <Campo id="metodo-cci" etiqueta="CCI">
                <Input id="metodo-cci" name="cci" maxLength={30} className="h-10" />
              </Campo>
            </>
          )}
          <Campo id="metodo-titular" etiqueta="Titular" ayuda="Puede ser otra persona." className="sm:col-span-2">
            <Input id="metodo-titular" name="holderName" required minLength={2} maxLength={80} defaultValue={`${ficha.firstName} ${ficha.lastName}`} className="h-10" />
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
