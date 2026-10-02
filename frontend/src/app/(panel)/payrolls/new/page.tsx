'use client'

import Link from 'next/link'
import { PayrollForm } from '@/components/payrolls/payroll-form'
import { buttonVariants } from '@/components/ui/button'
import { useMe } from '@/lib/me'

export default function NewPayrollPage() {
  const { data: me } = useMe()

  if (!me) return <p className="text-sm text-muted-foreground">Cargando…</p>
  if (me.role !== 'admin' && me.role !== 'accounting') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Nueva planilla</h1>
        <p className="text-sm text-muted-foreground">Tu rol no permite crear planillas.</p>
        <Link href="/payrolls" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Volver a la lista
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nueva planilla</h1>
      <PayrollForm />
    </div>
  )
}
