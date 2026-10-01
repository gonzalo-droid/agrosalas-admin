'use client'

import Link from 'next/link'
import { WorkerForm } from '@/components/workers/worker-form'
import { buttonVariants } from '@/components/ui/button'
import { canCreateWorker } from '@/lib/worker-view'
import { useMe } from '@/lib/me'

export default function NewWorkerPage() {
  const { data: me } = useMe()

  if (!me) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (!canCreateWorker(me.role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nuevo trabajador</h1>
        <p className="text-sm text-muted-foreground">Tu rol no puede registrar trabajadores. Pídeselo a Contabilidad o al administrador.</p>
        <Link href="/trabajadores" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo trabajador</h1>
      <WorkerForm canEdit />
      <p className="text-sm text-muted-foreground">Los métodos de pago y los grupos se agregan después de guardar.</p>
    </div>
  )
}
