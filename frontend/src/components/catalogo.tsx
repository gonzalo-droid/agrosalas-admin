'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorApiCliente, mensajeDeError } from '@/lib/api'
import {
  aplicarCambio,
  camposVisibles,
  cuerpoParaEnviar,
  opcionesVisibles,
  valorInicial,
  type CampoCatalogo,
  type FilaCatalogo,
  type Valor,
  type Valores,
} from '@/lib/catalogo-valores'
import { Campo, claseControl } from './campo'
import { ErrorConReintento } from './error-con-reintento'

export type { CampoCatalogo, FilaCatalogo }

type Props = {
  titulo: string
  descripcion?: string
  textoNuevo: string
  claveConsulta: string
  puedeEditar: boolean
  columnas: { titulo: string; derecha?: boolean; celda: (fila: FilaCatalogo) => React.ReactNode }[]
  campos: CampoCatalogo[]
  listar: () => Promise<{ datos: FilaCatalogo[] }>
  crear: (valores: Record<string, unknown>) => Promise<unknown>
  editar: (id: string, valores: Record<string, unknown>) => Promise<unknown>
  // Permite proponer un campo a partir de otro (por ejemplo, la hora extra desde la hora normal). Solo al crear.
  derivar?: (campo: string, valores: Valores) => Partial<Valores>
  accionesFila?: (fila: FilaCatalogo) => React.ReactNode
}

const TIPO_INPUT = { texto: 'text', correo: 'email', clave: 'password', hora: 'time', fecha: 'date', numero: 'number' } as const
// El navegador no debe rellenar estos formularios con los datos de quien los usa (p. ej. en "Nuevo usuario").
const AUTOCOMPLETAR = { clave: 'new-password' } as Partial<Record<CampoCatalogo['tipo'], string>>

export function Catalogo(props: Props) {
  const cliente = useQueryClient()
  const { data, isPending, error, refetch } = useQuery({ queryKey: [props.claveConsulta], queryFn: props.listar })
  const [abierto, setAbierto] = useState(false)
  const [fila, setFila] = useState<FilaCatalogo | null>(null)
  const [valores, setValores] = useState<Valores>({})
  const [errorCampo, setErrorCampo] = useState<{ campo?: string; mensaje: string } | null>(null)

  const campos = camposVisibles(props.campos, valores, fila !== null)
  const tieneActivo = fila !== null && typeof fila.activo === 'boolean'

  function abrir(paraEditar: FilaCatalogo | null) {
    const iniciales: Valores = Object.fromEntries(props.campos.map((c) => [c.nombre, valorInicial(c, paraEditar)]))
    if (paraEditar && typeof paraEditar.activo === 'boolean') iniciales.activo = paraEditar.activo
    setFila(paraEditar)
    setValores(iniciales)
    setErrorCampo(null)
    setAbierto(true)
  }

  function cambiar(campo: string, valor: Valor) {
    setValores((v) => aplicarCambio(v, campo, valor, props.derivar, fila !== null))
  }

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo = cuerpoParaEnviar(props.campos, valores, fila !== null)
      if (tieneActivo) cuerpo.activo = valores.activo
      return fila ? props.editar(fila.id, cuerpo) : props.crear(cuerpo)
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: [props.claveConsulta] })
      setAbierto(false)
      toast.success('Guardado')
    },
    onError: (e) => setErrorCampo({ campo: e instanceof ErrorApiCliente ? e.campo : undefined, mensaje: mensajeDeError(e) }),
  })

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{props.titulo}</h2>
          {props.descripcion && <p className="text-sm text-muted-foreground">{props.descripcion}</p>}
        </div>
        {props.puedeEditar && (
          <Button size="lg" onClick={() => abrir(null)}>
            {props.textoNuevo}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {props.columnas.map((c) => (
                <TableHead key={c.titulo} className={c.derecha ? 'text-right' : undefined}>
                  {c.titulo}
                </TableHead>
              ))}
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2}>
                  <ErrorConReintento error={error} alReintentar={refetch} />
                </TableCell>
              </TableRow>
            )}
            {data?.datos.length === 0 && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2} className="text-muted-foreground">
                  Aún no hay registros.
                </TableCell>
              </TableRow>
            )}
            {data?.datos.map((f) => (
              <TableRow key={f.id}>
                {props.columnas.map((c) => (
                  <TableCell key={c.titulo} className={c.derecha ? 'text-right tabular-nums' : undefined}>
                    {c.celda(f)}
                  </TableCell>
                ))}
                <TableCell>
                  <Badge variant={f.activo === false ? 'outline' : 'secondary'}>{f.activo === false ? 'Inactivo' : 'Activo'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {props.accionesFila?.(f)}
                  {props.puedeEditar && (
                    <Button
                      variant="ghost"
                      size="lg"
                      aria-label={typeof f.nombre === 'string' ? `Editar ${f.nombre}` : undefined}
                      onClick={() => abrir(f)}
                    >
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={(o) => setAbierto(o)}>
        {/* Con un formulario largo o el teclado del teléfono abierto, el contenido se desplaza hasta "Guardar". */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fila ? 'Editar' : props.textoNuevo}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setErrorCampo(null)
              guardar.mutate()
            }}
          >
            {campos.map((c) => {
              const id = `campo-${c.nombre}`
              const error = errorCampo?.campo === c.nombre ? errorCampo.mensaje : undefined
              const valor = valores[c.nombre]
              if (c.tipo === 'casilla') {
                return (
                  <div key={c.nombre} className="space-y-1">
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(valor)} onChange={(e) => cambiar(c.nombre, e.target.checked)} />
                      {c.etiqueta}
                    </label>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                )
              }
              if (c.tipo === 'opciones') {
                const elegidas = (valor as string[]) ?? []
                return (
                  <fieldset key={c.nombre} className="space-y-1">
                    <legend className="text-sm font-medium">{c.etiqueta}</legend>
                    {opcionesVisibles(c, fila).map((o) => (
                      <label key={o.valor} className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={elegidas.includes(o.valor)}
                          onChange={(e) =>
                            cambiar(c.nombre, e.target.checked ? [...elegidas, o.valor] : elegidas.filter((v) => v !== o.valor))
                          }
                        />
                        {o.etiqueta}
                      </label>
                    ))}
                    {error ? (
                      <p className="text-xs text-destructive">{error}</p>
                    ) : (
                      c.ayuda && <p className="text-xs text-muted-foreground">{c.ayuda}</p>
                    )}
                  </fieldset>
                )
              }
              return (
                <Campo key={c.nombre} id={id} etiqueta={c.etiqueta} ayuda={c.ayuda} error={error}>
                  {c.tipo === 'opcion' ? (
                    <select id={id} className={claseControl} value={String(valor ?? '')} onChange={(e) => cambiar(c.nombre, e.target.value)}>
                      {opcionesVisibles(c, fila).map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      className="h-10"
                      type={TIPO_INPUT[c.tipo]}
                      step={c.tipo === 'numero' ? 'any' : undefined}
                      required={c.obligatorio}
                      autoComplete={AUTOCOMPLETAR[c.tipo] ?? 'off'}
                      value={String(valor ?? '')}
                      onChange={(e) => cambiar(c.nombre, e.target.value)}
                    />
                  )}
                </Campo>
              )
            })}
            {tieneActivo && (
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(valores.activo)} onChange={(e) => cambiar('activo', e.target.checked)} />
                Activo
              </label>
            )}
            {errorCampo && !campos.some((c) => c.nombre === errorCampo.campo) && (
              <p role="alert" className="text-sm text-destructive">
                {errorCampo.mensaje}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={guardar.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
