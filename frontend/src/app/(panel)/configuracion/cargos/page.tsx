'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import type { Valores } from '@/lib/catalogo-valores'
import { formatoSoles, horaExtraPropuesta } from '@/lib/formato'

// Las tarifas por hora solo se piden (y se guardan) en los cargos por hora; el sueldo, en los mensuales.
const esPorHora = (valores: Valores) => valores.tipoPago === 'por_hora'

export default function PaginaCargos() {
  return (
    <Catalogo
      titulo="Cargos y tarifas de referencia"
      descripcion="Al registrar un día, las tarifas del cargo se copian al registro y ahí se pueden cambiar sin afectar al cargo."
      textoNuevo="Nuevo cargo"
      claveConsulta="cargos"
      puedeEditar
      columnas={[
        { titulo: 'Cargo', celda: (f) => String(f.nombre) },
        { titulo: 'Pago', celda: (f) => (f.tipoPago === 'mensual' ? 'Sueldo mensual' : 'Por hora') },
        { titulo: 'Hora normal', derecha: true, celda: (f) => formatoSoles(f.tarifaHora as number | null) },
        { titulo: 'Hora extra', derecha: true, celda: (f) => formatoSoles(f.tarifaHoraExtra as number | null) },
        { titulo: 'Sueldo', derecha: true, celda: (f) => formatoSoles(f.sueldoMensual as number | null) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        {
          nombre: 'tipoPago',
          etiqueta: 'Forma de pago',
          tipo: 'opcion',
          opciones: [
            { valor: 'por_hora', etiqueta: 'Por hora' },
            { valor: 'mensual', etiqueta: 'Sueldo mensual' },
          ],
        },
        { nombre: 'tarifaHora', etiqueta: 'Hora normal (S/)', tipo: 'numero', obligatorio: true, visibleSi: esPorHora },
        {
          nombre: 'tarifaHoraExtra',
          etiqueta: 'Hora extra (S/)',
          tipo: 'numero',
          obligatorio: true,
          visibleSi: esPorHora,
          ayuda: 'Se propone la normal más 25 %; puedes cambiarla.',
        },
        { nombre: 'sueldoMensual', etiqueta: 'Sueldo mensual (S/)', tipo: 'numero', obligatorio: true, visibleSi: (v) => v.tipoPago === 'mensual' },
      ]}
      derivar={(campo, valores) => {
        const normal = Number(valores.tarifaHora)
        return campo === 'tarifaHora' && normal > 0 ? { tarifaHoraExtra: String(horaExtraPropuesta(normal)) } : {}
      }}
      listar={() => leer(api.v1.cargos.$get())}
      crear={(json) => leer(api.v1.cargos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.cargos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
