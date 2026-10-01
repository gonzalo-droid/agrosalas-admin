// Error of an incomplete installation (a NEXT_PUBLIC_* variable is missing): not a network or API failure.
export class ConfigError extends Error {
  name = 'ConfigError'
}

// Checks the variables when they are used (not when the module is imported), so the build and the tests
// work without them. Next only inlines NEXT_PUBLIC_* written literally as process.env.NAME,
// so the caller passes the values already read.
export function requireEnv<T extends Record<string, string | undefined>>(variables: T): { [K in keyof T]: string } {
  const missing = Object.entries(variables)
    .filter(([, value]) => !value)
    .map(([name]) => name)
  if (missing.length > 0) {
    throw new ConfigError(
      `Falta configurar ${missing.join(', ')}. Cópialas de frontend/.env.example a frontend/.env.local y reinicia el panel.`,
    )
  }
  return variables as { [K in keyof T]: string }
}
