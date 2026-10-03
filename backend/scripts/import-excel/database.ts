/**
 * The line printed before a load says where it writes: the host and the Supabase project, never the user or the
 * password of DATABASE_URL. The project comes from a direct host (db.<ref>.supabase.co) or a pooler user (postgres.<ref>).
 */
export function describeDatabase(databaseUrl: string): string {
  let url: URL
  try {
    url = new URL(databaseUrl)
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') throw new Error('not postgres')
  } catch {
    // The value itself is not echoed: it may hold the password.
    throw new Error('DATABASE_URL no es una URL válida.')
  }
  const host = url.hostname
  const projectRef =
    /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1] ?? /^postgres\.([a-z0-9]+)$/.exec(decodeURIComponent(url.username))?.[1]
  return `Base de datos: ${host}${projectRef ? ` (proyecto ${projectRef})` : ''}`
}
