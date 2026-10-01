import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">La dirección no existe o ya no está disponible.</p>
        <Link href="/" className={buttonVariants({ size: 'lg' })}>
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
