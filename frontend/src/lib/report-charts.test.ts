import { describe, expect, it } from 'vitest'
import { areaChart, axisSoles, campaignChart, chartHeight, chartSummary, isEmptyChart, periodChart, soles, workerChart, type ChartData } from './report-charts'

const range = { from: '2026-10-01', to: '2026-10-31' }

describe('soles', () => {
  it('turns cents into soles', () => {
    expect(soles(6823)).toBe(68.23)
    expect(soles(0)).toBe(0)
    expect(soles(-1050)).toBe(-10.5)
  })
})

describe('axisSoles', () => {
  it('writes whole soles with a thousands comma', () => {
    expect(axisSoles(3200)).toBe('S/ 3,200')
    expect(axisSoles(0)).toBe('S/ 0')
    expect(axisSoles(1234.56)).toBe('S/ 1,235')
  })

  it('writes a negative like formatSoles does', () => {
    expect(axisSoles(-200)).toBe('S/ -200')
  })

  it('never writes a negative zero', () => {
    expect(axisSoles(-0.2)).toBe('S/ 0')
  })
})

describe('periodChart', () => {
  it('has one row per week, with the label cut by the range and a negative item going below zero', () => {
    const data = periodChart(
      [
        { weekStart: '2026-09-28', weekEnd: '2026-10-04', attendanceCents: 10000, itemsCents: -2550 },
        { weekStart: '2026-10-05', weekEnd: '2026-10-11', attendanceCents: 6823, itemsCents: 500 },
      ],
      range,
    )
    expect(data.rows).toEqual([
      { label: '01/10 al 04/10/2026', tick: '01/10', attendance: 100, items: -25.5 },
      { label: '05/10 al 11/10/2026', tick: '05/10', attendance: 68.23, items: 5 },
    ])
    expect(data.series).toEqual([
      { key: 'attendance', label: 'Asistencia', color: 'primary' },
      { key: 'items', label: 'Conceptos', color: 'amber' },
    ])
  })

  it('ticks a week with the first day it shows: the week start, or the range start when the range cuts the week', () => {
    const data = periodChart([{ weekStart: '2026-09-28', weekEnd: '2026-10-04', attendanceCents: 100, itemsCents: 0 }], range)
    expect(data.rows[0].tick).toBe('01/10')
    const full = periodChart([{ weekStart: '2026-10-12', weekEnd: '2026-10-18', attendanceCents: 100, itemsCents: 0 }], range)
    expect(full.rows[0].tick).toBe('12/10')
  })

  it('labels the months, with no short tick', () => {
    const data = periodChart([{ month: '2026-10', attendanceCents: 100, itemsCents: 0 }], range)
    expect(data.rows).toEqual([{ label: 'Octubre 2026', attendance: 1, items: 0 }])
    expect('tick' in data.rows[0]).toBe(false)
  })
})

describe('areaChart', () => {
  it('adds the items bar after the areas when there are items', () => {
    const data = areaChart({
      items: [
        { areaName: 'Campo', attendanceCents: 12345 },
        { areaName: 'Sin área', attendanceCents: 500 },
      ],
      itemsCents: -1000,
    })
    expect(data.rows).toEqual([
      { label: 'Campo', amount: 123.45 },
      { label: 'Sin área', amount: 5 },
      { label: 'Conceptos (sin área)', amount: -10 },
    ])
    expect(data.series).toEqual([{ key: 'amount', label: 'Monto', color: 'primary' }])
  })

  it('leaves the items bar out when there are none', () => {
    const data = areaChart({ items: [{ areaName: 'Campo', attendanceCents: 100 }], itemsCents: 0 })
    expect(data.rows).toEqual([{ label: 'Campo', amount: 1 }])
  })
})

describe('campaignChart', () => {
  it('draws a negative pending as zero', () => {
    const data = campaignChart([
      { name: 'Palta 2026', paidCents: 5000, pendingCents: 2823 },
      { name: 'Uva 2026', paidCents: 3000, pendingCents: -1000 },
    ])
    expect(data.rows).toEqual([
      { label: 'Palta 2026', paid: 50, pending: 28.23 },
      { label: 'Uva 2026', paid: 30, pending: 0 },
    ])
    expect(data.series).toEqual([
      { key: 'paid', label: 'Pagado', color: 'primary' },
      { key: 'pending', label: 'Pendiente', color: 'amber' },
    ])
  })
})

describe('workerChart', () => {
  const worker = (n: number, totalCents: number, paidCents = totalCents, pendingCents = 0) => ({
    firstName: `Nombre${String(n).padStart(2, '0')}`,
    lastName: `Apellido${String(n).padStart(2, '0')}`,
    paidCents,
    pendingCents,
    totalCents,
  })

  it('keeps the 10 with the highest total and groups the rest in "Otros (N)"', () => {
    // Totals 100, 200, …, 1200; paid is the total minus 50 and pending is 50.
    const items = Array.from({ length: 12 }, (_, i) => worker(i + 1, (i + 1) * 100, (i + 1) * 100 - 50, 50))
    // The two lowest totals are workers 1 and 2; the second has a negative pending, which must not subtract.
    items[0] = worker(1, 100, 100, 0)
    items[1] = worker(2, 200, 300, -100)
    const data = workerChart(items)
    expect(data.rows).toHaveLength(11)
    expect(data.rows[0]).toEqual({ label: 'Apellido12, Nombre12', paid: 11.5, pending: 0.5 })
    expect(data.rows[9]).toEqual({ label: 'Apellido03, Nombre03', paid: 2.5, pending: 0.5 })
    expect(data.rows[10]).toEqual({ label: 'Otros (2)', paid: 4, pending: 0 })
    expect(data.series).toEqual([
      { key: 'paid', label: 'Pagado', color: 'primary' },
      { key: 'pending', label: 'Pendiente', color: 'amber' },
    ])
  })

  it('sums the pending of the rest when it is positive', () => {
    const items = [worker(1, 500), worker(2, 400, 300, 100), worker(3, 300, 100, 200)]
    const data = workerChart(items, 1)
    expect(data.rows).toEqual([
      { label: 'Apellido01, Nombre01', paid: 5, pending: 0 },
      { label: 'Otros (2)', paid: 4, pending: 3 },
    ])
  })

  it('breaks ties by last name and then first name', () => {
    const data = workerChart([
      { firstName: 'Zoe', lastName: 'Perez', paidCents: 100, pendingCents: 0, totalCents: 100 },
      { firstName: 'Ana', lastName: 'Perez', paidCents: 100, pendingCents: 0, totalCents: 100 },
      { firstName: 'Luis', lastName: 'Alva', paidCents: 100, pendingCents: 0, totalCents: 100 },
    ])
    expect(data.rows.map((row) => row.label)).toEqual(['Alva, Luis', 'Perez, Ana', 'Perez, Zoe'])
  })

  it('has no "Otros" row with 3 workers', () => {
    const data = workerChart([worker(1, 100), worker(2, 300), worker(3, 200)])
    expect(data.rows.map((row) => row.label)).toEqual(['Apellido02, Nombre02', 'Apellido03, Nombre03', 'Apellido01, Nombre01'])
  })
})

describe('chartHeight', () => {
  const rows = (count: number): ChartData => ({ rows: Array.from({ length: count }, (_, i) => ({ label: `R${i}`, amount: 1 })), series: [] })

  it('is fixed for vertical bars', () => {
    expect(chartHeight(rows(3), 'vertical')).toBe(260)
    expect(chartHeight(rows(11), 'vertical')).toBe(260)
  })

  it('grows with the rows for horizontal bars, with a floor', () => {
    expect(chartHeight(rows(2), 'horizontal')).toBe(160)
    expect(chartHeight(rows(11), 'horizontal')).toBe(456)
  })
})

describe('isEmptyChart', () => {
  const series = [{ key: 'amount', label: 'Monto', color: 'primary' as const }]

  it('is true when every value is 0', () => {
    expect(isEmptyChart({ rows: [{ label: 'A', amount: 0 }, { label: 'B', amount: 0 }], series })).toBe(true)
  })

  it('is true without rows', () => {
    expect(isEmptyChart({ rows: [], series })).toBe(true)
  })

  it('ignores the short axis text', () => {
    expect(isEmptyChart({ rows: [{ label: 'A', tick: '01/10', amount: 0 }], series })).toBe(true)
  })

  it('is false with a value, even a negative one', () => {
    expect(isEmptyChart({ rows: [{ label: 'A', amount: 0 }, { label: 'B', amount: 1 }], series })).toBe(false)
    expect(isEmptyChart({ rows: [{ label: 'A', amount: -1 }], series })).toBe(false)
  })
})

describe('chartSummary', () => {
  const series: ChartData['series'] = [
    { key: 'paid', label: 'Pagado', color: 'primary' },
    { key: 'pending', label: 'Pendiente', color: 'amber' },
  ]

  it('lists each row with its series', () => {
    const data: ChartData = {
      rows: [
        { label: 'Palta', paid: 50, pending: 28.23 },
        { label: 'Uva', paid: 1234.5, pending: 0 },
      ],
      series,
    }
    expect(chartSummary('Pagado y pendiente por campaña', data)).toBe(
      'Pagado y pendiente por campaña: Palta: Pagado S/ 50.00, Pendiente S/ 28.23; Uva: Pagado S/ 1,234.50, Pendiente S/ 0.00',
    )
  })

  it('keeps the first 12 rows and counts the rest', () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ label: `C${i + 1}`, paid: i + 1, pending: 0 }))
    const text = chartSummary('Título', { rows, series })
    expect(text).toContain('C12: Pagado S/ 12.00, Pendiente S/ 0.00')
    expect(text).not.toContain('C13')
    expect(text.endsWith('; y 3 más')).toBe(true)
  })
})
