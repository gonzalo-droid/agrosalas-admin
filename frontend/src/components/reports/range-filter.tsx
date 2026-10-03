import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'

// Desde / Hasta. The range lives in the address, so a change is reported only when the date is complete: the browser
// gives '' while a date is half typed, and that must not clear the range.
export function RangeFilter({
  from,
  to,
  onChange,
  toError,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
  toError?: string
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-3 sm:max-w-md sm:grid-cols-2">
      <Field id="report-from" label="Desde">
        <Input id="report-from" type="date" className="h-11" value={from} onChange={(e) => e.target.value && onChange({ from: e.target.value, to })} />
      </Field>
      <Field id="report-to" label="Hasta" error={toError}>
        <Input
          id="report-to"
          type="date"
          className="h-11"
          aria-invalid={toError ? true : undefined}
          value={to}
          onChange={(e) => e.target.value && onChange({ from, to: e.target.value })}
        />
      </Field>
    </div>
  )
}
