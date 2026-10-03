import { REVIEW_TEXT, type ParsedSheet, type ParsedWorker, type ReviewReason } from './parse-sheet.js'
import { SHEETS, type PaymentRule } from './sheets.js'
import { aliasDni, splitName, workerKey } from './names.js'

/** A negative amount (cents) or count of minutes: the database rejects both. */
export type NegativeValue = { sheet: string; worker: string; what: string; value: number; unit: 'cents' | 'minutes' }

const REASONS = Object.keys(REVIEW_TEXT) as ReviewReason[]

const money = (cents: number): string => `${cents < 0 ? '-' : ''}S/ ${(Math.abs(cents) / 100).toFixed(2)}`

const dateText = (iso: string): string => iso.split('-').reverse().join('/')

const hasData = (worker: ParsedWorker): boolean =>
  worker.days.length > 0 || worker.amountWithoutHoursCents !== 0 || worker.totalCents !== 0 || worker.paidCents !== 0

/** What the panel will hold for the worker: their days plus the amount without hours, never the Excel row total. */
const importedCents = (worker: ParsedWorker): number =>
  worker.days.reduce((sum, day) => sum + day.amountCents, 0) + worker.amountWithoutHoursCents

/** Every negative amount or minutes the parser let through: the database rejects them, so the load must refuse. */
export function findNegatives(sheets: ParsedSheet[]): NegativeValue[] {
  const found: NegativeValue[] = []
  for (const sheet of sheets) {
    for (const worker of sheet.workers) {
      const add = (what: string, value: number, unit: NegativeValue['unit'] = 'cents') =>
        found.push({ sheet: sheet.sheet, worker: worker.name, what, value, unit })
      for (const day of worker.days) {
        const date = `día ${dateText(day.date)}`
        if (day.amountCents < 0) add(date, day.amountCents)
        if (day.workedMinutes < 0) add(`${date}, minutos trabajados`, day.workedMinutes, 'minutes')
        if (day.regularMinutes < 0) add(`${date}, minutos normales`, day.regularMinutes, 'minutes')
        if (day.overtimeMinutes < 0) add(`${date}, minutos extra`, day.overtimeMinutes, 'minutes')
      }
      if (worker.totalCents < 0) add('total de la fila', worker.totalCents)
      if (worker.paidCents < 0) add('pago', worker.paidCents)
    }
  }
  return found
}

/** "QUISPE MAMANI, LUIS, día 13/04/2026, minutos extra: -60 min" */
export const negativeText = (negative: NegativeValue): string =>
  `${negative.worker}, ${negative.what}: ${negative.unit === 'cents' ? money(negative.value) : `${negative.value} min`}`

const ruleText = (rule: PaymentRule | undefined): string => {
  if (!rule) return 'sin regla de pago configurada'
  if (rule.kind === 'columns') return `pagado = suma de las columnas ${rule.columns.join(' + ')}`
  return `pagado = el total de la fila si ${rule.columns.join(' o ')} dice ${rule.text}, si no 0`
}

function sheetSection(sheet: ParsedSheet): string[] {
  const withData = sheet.workers.filter(hasData)
  const days = withData.flatMap((worker) => worker.days)
  const excel = sheet.excelTotalCents
  const imported = withData.reduce((sum, worker) => sum + importedCents(worker), 0)
  const difference = excel - imported
  const paid = withData.reduce((sum, worker) => sum + worker.paidCents, 0)
  // Pending as the panel will show it: from the imported cents, so a cent the Excel rounding hides is not lost.
  const pending = imported - paid
  const reviewDays = days.filter((day) => day.reasons.length > 0)

  const lines = [
    `## Hoja "${sheet.sheet}"`,
    '',
    `- Campaña: ${sheet.campaign}`,
    `- Fechas: ${dateText(sheet.startDate)} al ${dateText(sheet.endDate)}`,
    `- Tarifas: hora S/ ${sheet.hourlyRate}, hora extra S/ ${sheet.overtimeRate}`,
    `- Trabajadores con datos: ${withData.length}`,
    `- Días: ${days.length}`,
    `- Días a revisar: ${reviewDays.length}`,
  ]
  for (const reason of REASONS) {
    const count = reviewDays.filter((day) => day.reasons.includes(reason)).length
    if (count > 0) lines.push(`  - ${REVIEW_TEXT[reason]}: ${count}`)
  }
  lines.push(
    `- Total del Excel: ${money(excel)}`,
    `- Total importado (asistencia + montos sin horas): ${money(imported)}`,
    `- Diferencia: ${money(difference)}`,
  )
  // The days of a worker add up to their TOTALs rounded once, so only rounding separates the two totals; half a cent
  // per day is a safe upper bound for it.
  if (Math.abs(difference) > days.length * 0.5) lines.push('- ⚠ Diferencia mayor que el redondeo')
  lines.push(`- Pagado: ${money(paid)}`, `- Pendiente: ${money(pending)}`, '')

  const negatives = findNegatives([sheet])
  for (const negative of negatives) {
    lines.push(`- ⚠ ${negative.unit === 'cents' ? 'Monto negativo' : 'Minutos negativos'}: ${negativeText(negative)}`)
  }
  if (negatives.length > 0) lines.push('')

  const warnings = withData.flatMap((worker) => worker.warnings.map((warning) => `- ⚠ ${worker.name}: ${warning}`))
  if (warnings.length > 0) lines.push(...warnings, '')

  lines.push(
    '| Trabajador | Días | Importado | Total del Excel | Pagado | Pendiente | Motivos |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
  )
  for (const worker of withData) {
    const reasons = REASONS.flatMap((reason) => {
      const count = worker.days.filter((day) => day.reasons.includes(reason)).length
      return count > 0 ? [`${REVIEW_TEXT[reason]} (${count})`] : []
    })
    const workerImported = importedCents(worker)
    lines.push(
      `| ${worker.name} | ${worker.days.length} | ${money(workerImported)} | ${money(worker.totalCents)} | ${money(
        worker.paidCents,
      )} | ${money(workerImported - worker.paidCents)} | ${reasons.join('; ')} |`,
    )
  }
  lines.push('')
  return lines
}

export function buildSummary(
  sheets: ParsedSheet[],
  options: {
    similar: [string, string][]
    aliasesUsed: [string, string][]
    unusedAliases: string[]
    mode?: 'dry-run' | 'commit'
  },
): string {
  const modeText =
    options.mode === 'commit'
      ? 'Carga en la base: se escribe todo en una sola transacción.'
      : 'Prueba en seco: no se escribió nada en la base.'
  const lines = ['# Resumen de la importación del Excel', '', modeText, '']
  for (const sheet of sheets) lines.push(...sheetSection(sheet))

  // One per matching key, as the load sees them; whether each one already exists is only known when loading.
  const withData = new Map<string, string>()
  for (const worker of sheets.flatMap((sheet) => sheet.workers.filter(hasData))) {
    if (!withData.has(workerKey(worker.name))) withData.set(workerKey(worker.name), worker.name)
  }
  lines.push(
    `## Trabajadores con datos (${withData.size})`,
    '',
    'La carga reutiliza al trabajador existente con el mismo nombre (sin tildes) y sin DNI, o lo crea; al terminar dice cuáles reutilizó y cuáles creó.',
    '',
  )
  for (const name of withData.values()) {
    const dni = aliasDni(name)
    if (dni !== null) {
      lines.push(`- ${name} → el trabajador existente con DNI ${dni}`)
      continue
    }
    const { lastName, firstName } = splitName(name)
    lines.push(`- ${name} → apellidos: ${lastName}; nombres: ${firstName}`)
  }
  lines.push('')

  lines.push(`## Alias aplicados (${options.aliasesUsed.length})`, '')
  if (options.aliasesUsed.length === 0) lines.push('Ninguno.')
  for (const [raw, unified] of options.aliasesUsed) lines.push(`- ${raw} → ${unified}`)
  lines.push('')

  lines.push(`## Alias sin efecto (${options.unusedAliases.length})`, '')
  if (options.unusedAliases.length === 0) lines.push('Ninguno.')
  for (const key of options.unusedAliases) lines.push(`- ${key}`)
  lines.push('')

  lines.push(`## Nombres parecidos sin unificar (${options.similar.length})`, '')
  if (options.similar.length === 0) lines.push('Ninguno.')
  for (const [a, b] of options.similar) lines.push(`- ${a} ≈ ${b}`)
  lines.push('')

  const withoutHours = sheets.flatMap((sheet) =>
    sheet.workers
      .filter((worker) => worker.amountWithoutHoursCents !== 0)
      .map((worker) => `- ${sheet.sheet}: ${worker.name}, ${money(worker.amountWithoutHoursCents)} (se importa como concepto)`),
  )
  lines.push(`## Montos sin horas (${withoutHours.length})`, '')
  lines.push(...(withoutHours.length > 0 ? withoutHours : ['Ninguno.']), '')

  lines.push(
    '## Supuestos de pago (confirmar)',
    '',
    'El Excel no dice cuándo ni cómo se pagó. Cada pago se migra con fecha = último día del periodo, medio efectivo, detalle "Migrado del Excel" y nota "migrado".',
    '',
  )
  for (const sheet of sheets) {
    lines.push(`- ${sheet.sheet}: ${ruleText(SHEETS.find((config) => config.sheet === sheet.sheet)?.payment)}`)
  }
  lines.push('')
  return lines.join('\n')
}
