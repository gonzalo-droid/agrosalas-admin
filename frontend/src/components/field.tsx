import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

// text-base on phones (iOS zooms the page when a control under 16 px is tapped) and text-sm from md up, like Input.
export const controlClass =
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm'

// Label + control + help or error, always in the same order.
export function Field({
  id,
  label,
  help,
  error,
  className,
  children,
}: {
  id: string
  label: string
  help?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p className="text-xs text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}
