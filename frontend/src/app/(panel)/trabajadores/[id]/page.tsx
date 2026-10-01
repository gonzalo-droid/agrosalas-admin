'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { WorkerForm } from '@/components/workers/worker-form'
import { WorkerGroups } from '@/components/workers/worker-groups'
import { PaymentMethods } from '@/components/workers/payment-methods'
import { api, errorMessage, unwrap } from '@/lib/api'
import { workerView } from '@/lib/worker-view'
import { useMe } from '@/lib/me'

export default function WorkerPage() {
  const { id } = useParams<{ id: string }>()
  const { data: me } = useMe()
  const { data: worker, error } = useQuery({
    queryKey: ['workers', id],
    queryFn: () => unwrap(api.v1.workers[':id'].$get({ param: { id } })),
  })

  if (error && !worker) return <p className="text-sm text-destructive">{errorMessage(error)}</p>
  if (!worker || !me) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const view = workerView(me.role)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {worker.firstName} {worker.lastName}
      </h1>
      {/* key: when the record is refreshed, the form takes the new values */}
      <WorkerForm key={worker.updatedAt} worker={worker} canEdit={view.canEditRecord} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {view.paymentMethods !== 'hidden' && <PaymentMethods worker={worker} readOnly={view.paymentMethods === 'view'} />}
        <WorkerGroups worker={worker} readOnly={view.groups === 'view'} />
      </div>
    </div>
  )
}
