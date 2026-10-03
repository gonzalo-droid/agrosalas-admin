'use client'

import { useSyncExternalStore } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatSoles } from '@/lib/format'
import { chartSummary, isEmptyChart, type ChartColor, type ChartData } from '@/lib/report-charts'

const COLOR: Record<ChartColor, string> = { primary: 'var(--chart-1)', amber: 'var(--chart-2)', muted: 'var(--chart-3)' }

const VERTICAL_HEIGHT = 260
const ROW_HEIGHT = 36
// Wide enough for a name of the horizontal charts: 140 px on a phone, 200 px from `sm` (Tailwind's 640 px).
const NAME_WIDTH = { phone: 140, wide: 200 }
const WIDE_QUERY = '(min-width: 640px)'
// Rough width of one character of the axis text, to know how much of a long label fits.
const CHAR_WIDTH = 6.5

const subscribeToWidth = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(WIDE_QUERY).matches

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text)

type Props = {
  title: string
  data: ChartData
  // 'vertical' draws vertical bars (a name under each one), 'horizontal' draws horizontal bars (a name beside each one).
  layout: 'vertical' | 'horizontal'
}

export default function ReportChart({ title, data, layout }: Props) {
  const wide = useSyncExternalStore(subscribeToWidth, isWide, () => false)
  const empty = isEmptyChart(data)
  const horizontal = layout === 'horizontal'
  const height = horizontal ? Math.max(160, ROW_HEIGHT * data.rows.length + 60) : VERTICAL_HEIGHT

  const config: ChartConfig = Object.fromEntries(data.series.map((series) => [series.key, { label: series.label, color: COLOR[series.color] }]))

  // Recharts names the layout after the direction of the bars: its "vertical" has the names on the left axis.
  const nameWidth = wide ? NAME_WIDTH.wide : NAME_WIDTH.phone
  const longNames = data.rows.some((row) => row.label.length > 10)

  return (
    <section className="space-y-2 rounded-xl border bg-background p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      {empty ? (
        <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
          Sin montos en este rango.
        </p>
      ) : (
        <div role="img" aria-label={chartSummary(title, data)}>
          <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
            <BarChart data={data.rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" tickLine={false} axisLine={false} tickCount={4} tickFormatter={formatSoles} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={nameWidth}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(label: string) => truncate(label, Math.floor(nameWidth / CHAR_WIDTH))}
                  />
                  <ReferenceLine x={0} />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    angle={longNames ? -45 : 0}
                    textAnchor={longNames ? 'end' : 'middle'}
                    height={longNames ? 84 : 30}
                    tickFormatter={(label: string) => truncate(label, 20)}
                  />
                  <YAxis width={84} tickLine={false} axisLine={false} tickFormatter={formatSoles} />
                  <ReferenceLine y={0} />
                </>
              )}
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                          {name}
                        </span>
                        <span className="font-mono font-medium text-foreground tabular-nums">{formatSoles(Number(value))}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {data.series.map((series) => (
                <Bar key={series.key} dataKey={series.key} name={series.label} stackId="amount" fill={`var(--color-${series.key})`} maxBarSize={48} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </section>
  )
}
