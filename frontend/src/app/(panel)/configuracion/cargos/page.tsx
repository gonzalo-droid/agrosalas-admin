'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import type { Valores } from '@/lib/catalogo-valores'
import { formatoSoles, horaExtraPropuesta } from '@/lib/formato'

// Las tarifas por hora solo se piden (y se guardan) en los cargos por hora; el sueldo, en los mensuales.
const esPorHora = (valores: Valores) => valores.payType === 'hourly'

export default function PaginaCargos() {
  return (
    <Catalogo
      titulo="Cargos y tarifas de referencia"
      descripcion="Al registrar un día, las tarifas del cargo se copian al registro y ahí se pueden cambiar sin afectar al cargo."
      textoNuevo="Nuevo cargo"
      claveConsulta="cargos"
      puedeEditar
      columnas={[
        { titulo: 'Cargo', celda: (f) => String(f.name) },
        { titulo: 'Pago', celda: (f) => (f.payType === 'monthly' ? 'Sueldo mensual' : 'Por hora') },
        { titulo: 'Hora normal', derecha: true, celda: (f) => formatoSoles(f.hourlyRate as number | null) },
        { titulo: 'Hora extra', derecha: true, celda: (f) => formatoSoles(f.overtimeRate as number | null) },
        { titulo: 'Sueldo', derecha: true, celda: (f) => formatoSoles(f.monthlySalary as number | null) },
      ]}
      campos={[
        { nombre: 'name', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        {
          nombre: 'payType',
          etiqueta: 'Forma de pago',
          tipo: 'opcion',
          opciones: [
            { valor: 'hourly', etiqueta: 'Por hora' },
            { valor: 'monthly', etiqueta: 'Sueldo mensual' },
          ],
        },
        { nombre: 'hourlyRate', etiqueta: 'Hora normal (S/)', tipo: 'numero', obligatorio: true, visibleSi: esPorHora },
        {
          nombre: 'overtimeRate',
          etiqueta: 'Hora extra (S/)',
          tipo: 'numero',
          obligatorio: true,
          visibleSi: esPorHora,
          ayuda: 'Se propone la normal más 25 %; puedes cambiarla.',
        },
        { nombre: 'monthlySalary', etiqueta: 'Sueldo mensual (S/)', tipo: 'numero', obligatorio: true, visibleSi: (v) => v.payType === 'monthly' },
      ]}
      derivar={(campo, valores) => {
        const normal = Number(valores.hourlyRate)
        return campo === 'hourlyRate' && normal > 0 ? { overtimeRate: String(horaExtraPropuesta(normal)) } : {}
      }}
      listar={() => leer(api.v1.positions.$get())}
      crear={(json) => leer(api.v1.positions.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.positions[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
