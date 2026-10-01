import { isNetworkError } from './auth-errors'

export type LinkResult = 'recovery' | 'invalid' | 'network_error'

// What is used from supabase.auth (so the tests can pass a fake one).
export type RecoveryAuth = {
  initialize(): Promise<{ error: unknown }>
  onAuthStateChange(callback: (event: string) => void): { data: { subscription: { unsubscribe(): void } } }
  verifyOtp(params: { type: 'recovery'; token_hash: string }): Promise<{ error: unknown }>
}

// Decides whether this visit to the password reset page comes from a valid recovery link.
// A normal session already open in the browser NEVER counts as recovery.
export function checkRecoveryLink(
  auth: RecoveryAuth,
  params: URLSearchParams,
  marginMs = 100,
): Promise<LinkResult> {
  const tokenHash = params.get('token_hash')
  if (tokenHash && params.get('type') === 'recovery') return verifyToken(auth, tokenHash)
  return waitForRecoveryEvent(auth, marginMs)
}

// Link with ?token_hash=…&type=recovery (own email template): works on any device.
async function verifyToken(auth: RecoveryAuth, tokenHash: string): Promise<LinkResult> {
  await auth.initialize()
  const { error } = await auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (!error) return 'recovery'
  return isNetworkError(error) ? 'network_error' : 'invalid'
}

// Default link with ?code=… (PKCE). When created, the auth-js client exchanges the code in initialize()
// using the verifier that resetPasswordForEmail stored in THIS browser; if the verifier was marked
// as a recovery one, it emits PASSWORD_RECOVERY in a setTimeout(0) scheduled inside initialize().
// That is why the subscription is registered before waiting for initialize() and, when it finishes,
// a short margin is waited before concluding that there was no event.
function waitForRecoveryEvent(auth: RecoveryAuth, marginMs: number): Promise<LinkResult> {
  return new Promise((resolve) => {
    let finished = false
    let stopListening = () => {}
    const finish = (result: LinkResult) => {
      if (finished) return
      finished = true
      stopListening()
      resolve(result)
    }

    const { data } = auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') finish('recovery')
    })
    stopListening = () => data.subscription.unsubscribe()
    if (finished) stopListening()

    auth
      .initialize()
      .then(({ error }) => error, (error: unknown) => error)
      .then((error) => {
        setTimeout(() => finish(isNetworkError(error) ? 'network_error' : 'invalid'), marginMs)
      })
  })
}
