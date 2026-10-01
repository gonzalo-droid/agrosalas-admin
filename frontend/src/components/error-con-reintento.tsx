import { Button } from '@/components/ui/button'
import { mensajeDeError } from '@/lib/api'

// Mensaje de una lista que no se pudo cargar, con un botón para volver a pedirla.
export function ErrorConReintento({ error, alReintentar }: { error: unknown; alReintentar: () => unknown }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-destructive">
        {mensajeDeError(error)}
      </p>
      <Button variant="outline" size="lg" onClick={() => void alReintentar()}>
        Reintentar
      </Button>
    </div>
  )
}
