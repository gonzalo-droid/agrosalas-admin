'use client'

import dynamic from 'next/dynamic'
import { chartHeight, chartSummary, isEmptyChart, type ChartData } from '@/lib/report-charts'

// recharts is heavy: it loads only when a chart is drawn. The placeholder fills the wrapper, so it has the chart's height.
const BarChartView = dynamic(() => import('./bar-chart-view'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Cargando gráfico…</div>,
})

type Props = {
  title: string
  data: ChartData
  // 'vertical' draws vertical bars (a name under each one), 'horizontal' draws horizontal bars (a name beside each one).
  layout: 'vertical' | 'horizontal'
}

export function ReportChart({ title, data, layout }: Props) {
  const height = chartHeight(data, layout)

  return (
    <section className="space-y-2 rounded-xl border bg-background p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {isEmptyChart(data) ? (
        <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          Sin montos en este rango.
        </p>
      ) : (
        <div role="img" aria-label={chartSummary(title, data)} style={{ height }}>
          <BarChartView data={data} layout={layout} />
        </div>
      )}
    </section>
  )
}
