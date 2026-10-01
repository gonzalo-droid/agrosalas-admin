'use client'

import { FormularioTrabajador } from '@/components/trabajadores/formulario'

export default function PaginaNuevoTrabajador() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo trabajador</h1>
      <FormularioTrabajador puedeEditar />
      <p className="text-sm text-muted-foreground">Los métodos de pago y los grupos se agregan después de guardar.</p>
    </div>
  )
}
