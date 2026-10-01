import { redirect } from 'next/navigation'

// Hasta que exista Planillas (fase 2), la entrada del panel es Trabajadores.
export default function PaginaInicio() {
  redirect('/trabajadores')
}
