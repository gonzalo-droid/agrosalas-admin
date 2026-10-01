import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiClientError } from './api'
import { isExpiredSession } from './expired-session'

// A single place to react to an expired session: any query or mutation that receives the API's 401.
export function createQueryClient(onSessionExpired: () => void) {
  const check = (error: unknown) => {
    if (isExpiredSession(error)) onSessionExpired()
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: check }),
    mutationCache: new MutationCache({ onError: check }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // If the API answered with an error (401, 403, 404…) retrying is pointless; it only retries when there was no connection.
        retry: (attempts, error) => !(error instanceof ApiClientError && error.code !== 'network_error') && attempts < 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
