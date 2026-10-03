'use client'

import { useSyncExternalStore } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatSoles } from '@/lib/format'
import { axisSoles, type ChartColor, type ChartData } from '@/lib/report-charts'

const COLOR: Record<ChartColor, string> = { primary: 'var(--chart-1)', amber: 'var(--chart-2)', muted: 'var(--chart-3)' }

// Wide enough for a name of the horizontal charts: 140 px on a phone, 200 px from `sm` (Tailwind's 640 px).
const NAME_WIDTH = { phone: 140, wide: 200 }
const WIDE_QUERY = '(min-width: 640px)'
// Rough width of one character of the axis text, to know how much of a long label fits.
const CHAR_WIDTH = 7.5

const subscribeToWidth = (onChange: () => void) => {
  const query = window.matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const isWide = () => window.matchMedia(WIDE_QUERY).matches

// Cut to `max` characters and joined with non-breaking spaces: recharts breaks a tick at a plain space when the axis is narrow.
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, Math.max(1, max - 1))}…` : text).replace(/ /g, ' ')

type Props = {
  data: ChartData
  // 'vertical' draws vertical bars (a name under each one), 'horizontal' draws horizontal bars (a name beside each one).
  layout: 'vertical' | 'horizontal'
}

// Fills its parent: the wrapper of `ReportChart` sets the height.
export default function BarChartView({ data, layout }: Props) {
  const wide = useSyncExternalStore(subscribeToWidth, isWide, () => false)
  const horizontal = layout === 'horizontal'

  const config: ChartConfig = Object.fromEntries(data.series.map((series) => [series.key, { label: series.label, color: COLOR[series.color] }]))

  // Recharts names the layout after the direction of the bars: its "vertical" has the names on the left axis.
  const nameWidth = wide ? NAME_WIDTH.wide : NAME_WIDTH.phone
  // The short axis text of the rows (the weeks), when they have one; the tooltip still names the period in full.
  const nameKey = data.rows.some((row) => row.tick) ? 'tick' : 'label'

  return (
    <ChartContainer config={config} className="aspect-auto h-full w-full">
      <BarChart data={data.rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tickCount={4} tickFormatter={axisSoles} />
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
            {/* Recharts skips the ticks that do not fit; the tooltip names every period anyway. */}
            <XAxis dataKey={nameKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
            <YAxis width={72} tickLine={false} axisLine={false} tickFormatter={axisSoles} />
            <ReferenceLine y={0} />
          </>
        )}
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ''}
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
        {data.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {data.series.map((series) => (
          <Bar key={series.key} dataKey={series.key} name={series.label} stackId="amount" fill={`var(--color-${series.key})`} maxBarSize={48} />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
