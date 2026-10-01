import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'

// Message for a list that could not be loaded, with a button to request it again.
export function ErrorWithRetry({ error, onRetry }: { error: unknown; onRetry: () => unknown }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(error)}
      </p>
      <Button variant="outline" size="lg" onClick={() => void onRetry()}>
        Reintentar
      </Button>
    </div>
  )
}
