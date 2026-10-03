'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { toast } from 'sonner'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Field, controlClass } from '@/components/field'
import { AreaReport } from '@/components/reports/area-report'
import { CampaignReport } from '@/components/reports/campaign-report'
import { PeriodReport } from '@/components/reports/period-report'
import { RangeFilter } from '@/components/reports/range-filter'
import { WorkerReport } from '@/components/reports/worker-report'
import { Button } from '@/components/ui/button'
import { ApiClientError, api, errorMessage, unwrap } from '@/lib/api'
import { limaDate } from '@/lib/lima-time'
import { useMe } from '@/lib/me'
import { seesMoney } from '@/lib/payroll-view'
import { REPORT_TABS, rangeFromParams, reportTabFromParam, type ReportTab } from '@/lib/report-view'
import { cn } from '@/lib/utils'
import { areaSheet, campaignSheets, downloadXlsx, periodSheet, safeFileName, workerSheet, type Sheet } from '@/lib/xlsx'

// useSearchParams needs a Suspense boundary above it: without one, the build of the page fails.
export default function ReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <Reports />
    </Suspense>
  )
}

function Reports() {
  const { data: me } = useMe()
  if (!me) return <p className="text-sm text-muted-foreground">Cargando…</p>
  // Hiding by role is a convenience: the API enforces the permissions. The coordinator never gets to the queries.
  if (!seesMoney(me.role)) return <p className="text-sm text-muted-foreground">No tienes acceso a los reportes.</p>
  return <ReportsScreen />
}

function ReportsScreen() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const tab = reportTabFromParam(params.get('tab'))
  const { from, to } = rangeFromParams(params.get('from'), params.get('to'), limaDate(new Date()))
  const tabLabel = REPORT_TABS.find((t) => t.key === tab)?.label ?? ''

  // The tab and the range live in the address, so a link shares exactly what is on screen. Changing them replaces the
  // entry (no history per keystroke) and keeps the scroll.
  function go(changes: { tab?: ReportTab; from?: string; to?: string }) {
    const next = new URLSearchParams(params.toString())
    if (changes.tab === 'weekly') next.delete('tab')
    else if (changes.tab) next.set('tab', changes.tab)
    if (changes.from) next.set('from', changes.from)
    if (changes.to) next.set('to', changes.to)
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  // Only the active tab asks. Staleness 0: a report must never show numbers from before the last change to a payroll.
  const weekly = useQuery({
    queryKey: ['reports', 'weekly', from, to],
    queryFn: () => unwrap(api.v1.reports.costs.weekly.$get({ query: { from, to } })),
    enabled: tab === 'weekly',
    staleTime: 0,
  })
  const monthly = useQuery({
    queryKey: ['reports', 'monthly', from, to],
    queryFn: () => unwrap(api.v1.reports.costs.monthly.$get({ query: { from, to } })),
    enabled: tab === 'monthly',
    staleTime: 0,
  })
  const area = useQuery({
    queryKey: ['reports', 'area', from, to],
    queryFn: () => unwrap(api.v1.reports.costs['by-area'].$get({ query: { from, to } })),
    enabled: tab === 'area',
    staleTime: 0,
  })

  const campaign = useQuery({
    queryKey: ['reports', 'campaign', from, to],
    queryFn: () => unwrap(api.v1.reports.costs['by-campaign'].$get({ query: { from, to } })),
    enabled: tab === 'campaign',
    staleTime: 0,
  })
  const worker = useQuery({
    queryKey: ['reports', 'worker', from, to],
    queryFn: () => unwrap(api.v1.reports.costs['by-worker'].$get({ query: { from, to } })),
    enabled: tab === 'worker',
    staleTime: 0,
  })

  const active = { weekly, monthly, area, campaign, worker }[tab]
  const error = active?.error
  // A bad range (e.g. the end before the start) is shown under Hasta, where it is fixed; the rest, with a retry.
  const toError = error instanceof ApiClientError && error.field === 'to' ? error.message : undefined
  const sheets: (() => Sheet[]) | null =
    tab === 'weekly' && weekly.data
      ? () => [periodSheet('weekly', weekly.data)]
      : tab === 'monthly' && monthly.data
        ? () => [periodSheet('monthly', monthly.data)]
        : tab === 'area' && area.data
          ? () => [areaSheet(area.data)]
          : tab === 'campaign' && campaign.data
            ? () => campaignSheets(campaign.data)
            : tab === 'worker' && worker.data
              ? () => [workerSheet(worker.data)]
              : null

  function onTabKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = REPORT_TABS[(REPORT_TABS.findIndex((t) => t.key === tab) + (e.key === 'ArrowRight' ? 1 : REPORT_TABS.length - 1)) % REPORT_TABS.length].key
    go({ tab: next })
    document.getElementById(`report-tab-${next}`)?.focus()
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reportes</h1>

      {/* The other modules arrive with inventory, purchases and sales. */}
      <Field id="report-module" label="Módulo" className="max-w-xs">
        <select id="report-module" className={`${controlClass} h-11`} defaultValue="payroll">
          <option value="payroll">Planilla</option>
        </select>
      </Field>

      <div role="tablist" aria-label="Reportes" className="flex gap-1 overflow-x-auto border-b">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`report-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`report-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={cn(
              '-mb-px h-11 shrink-0 border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              tab === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => go({ tab: t.key })}
            onKeyDown={onTabKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`report-panel-${tab}`} aria-labelledby={`report-tab-${tab}`} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <RangeFilter from={from} to={to} onChange={go} toError={toError} />
          <ExportButton sheets={sheets} fileName={`${safeFileName(`Reporte ${tabLabel} ${from} a ${to}`)}.xlsx`} />
        </div>

        {error && !active.data ? (
          toError ? null : <ErrorWithRetry error={error} onRetry={active.refetch} />
        ) : active.isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : tab === 'weekly' && weekly.data ? (
          <PeriodReport tab="weekly" data={weekly.data} />
        ) : tab === 'monthly' && monthly.data ? (
          <PeriodReport tab="monthly" data={monthly.data} />
        ) : tab === 'area' && area.data ? (
          <AreaReport data={area.data} />
        ) : tab === 'campaign' && campaign.data ? (
          <CampaignReport data={campaign.data} />
        ) : tab === 'worker' && worker.data ? (
          <WorkerReport data={worker.data} />
        ) : null}
      </div>
    </div>
  )
}

// Makes the workbook in the browser from what is on screen; disabled while there is nothing to export.
function ExportButton({ sheets, fileName }: { sheets: (() => Sheet[]) | null; fileName: string }) {
  const exportXlsx = useMutation({
    mutationFn: async (makeSheets: () => Sheet[]) => downloadXlsx(makeSheets(), fileName),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Button variant="outline" size="lg" className="h-11" disabled={!sheets || exportXlsx.isPending} onClick={() => sheets && exportXlsx.mutate(sheets)}>
      {exportXlsx.isPending ? 'Preparando…' : 'Exportar a Excel'}
    </Button>
  )
}
