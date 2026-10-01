import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ErrorApiCliente } from './api'
import { esSesionVencida } from './sesion-vencida'

// Un solo lugar para reaccionar a una sesión vencida: cualquier consulta o mutación que reciba el 401 de la API.
export function crearClienteConsultas(alVencerseLaSesion: () => void) {
  const revisar = (error: unknown) => {
    if (esSesionVencida(error)) alVencerseLaSesion()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: revisar }),
    mutationCache: new MutationCache({ onError: revisar }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Si la API respondió con un error (401, 403, 404…) reintentar no sirve; solo se reintenta si no hubo conexión.
        retry: (intentos, error) => !(error instanceof ErrorApiCliente && error.code !== 'network_error') && intentos < 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
