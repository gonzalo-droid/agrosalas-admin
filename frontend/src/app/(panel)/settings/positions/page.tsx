'use client'

import { Catalog } from '@/components/catalog'
import { api, unwrap } from '@/lib/api'
import type { Values } from '@/lib/catalog-values'
import { formatSoles, suggestedOvertimeRate } from '@/lib/format'

// Hourly rates are only asked for (and saved) on hourly positions; the salary, on monthly ones.
const isHourly = (values: Values) => values.payType === 'hourly'

export default function PositionsPage() {
  return (
    <Catalog
      title="Cargos y tarifas de referencia"
      description="Al registrar un día, las tarifas del cargo se copian al registro y ahí se pueden cambiar sin afectar al cargo."
      newLabel="Nuevo cargo"
      queryKey="positions"
      canEdit
      columns={[
        { title: 'Cargo', cell: (row) => String(row.name) },
        { title: 'Pago', cell: (row) => (row.payType === 'monthly' ? 'Sueldo mensual' : 'Por hora') },
        { title: 'Hora normal', right: true, cell: (row) => formatSoles(row.hourlyRate as number | null) },
        { title: 'Hora extra', right: true, cell: (row) => formatSoles(row.overtimeRate as number | null) },
        { title: 'Sueldo', right: true, cell: (row) => formatSoles(row.monthlySalary as number | null) },
      ]}
      fields={[
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        {
          name: 'payType',
          label: 'Forma de pago',
          type: 'select',
          options: [
            { value: 'hourly', label: 'Por hora' },
            { value: 'monthly', label: 'Sueldo mensual' },
          ],
        },
        { name: 'hourlyRate', label: 'Hora normal (S/)', type: 'number', required: true, visibleIf: isHourly },
        {
          name: 'overtimeRate',
          label: 'Hora extra (S/)',
          type: 'number',
          required: true,
          visibleIf: isHourly,
          help: 'Se propone la normal más 25 %; puedes cambiarla.',
        },
        { name: 'monthlySalary', label: 'Sueldo mensual (S/)', type: 'number', required: true, visibleIf: (v) => v.payType === 'monthly' },
      ]}
      derive={(field, values) => {
        const regular = Number(values.hourlyRate)
        return field === 'hourlyRate' && regular > 0 ? { overtimeRate: String(suggestedOvertimeRate(regular)) } : {}
      }}
      list={() => unwrap(api.v1.positions.$get())}
      create={(json) => unwrap(api.v1.positions.$post({ json: json as never }))}
      update={(id, json) => unwrap(api.v1.positions[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
