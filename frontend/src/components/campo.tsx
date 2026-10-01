import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

// text-base en teléfonos (iOS acerca la página al tocar un control de menos de 16 px) y text-sm desde md, como Input.
export const claseControl =
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm'

// Etiqueta + control + ayuda o error, siempre en el mismo orden.
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-xs text-muted-foreground">{ayuda}</p>
      ) : null}
    </div>
  )
}
