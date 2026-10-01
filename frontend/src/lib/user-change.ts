// Decides, on a Supabase Auth event, whether the data kept in memory no longer belongs to whoever is using the tab.
// `previous` is undefined until the first event (INITIAL_SESSION), which only serves to note who is there.
export function shouldClearCache(event: string, previous: string | null | undefined, current: string | null) {
  if (event === 'SIGNED_OUT') return true
  return previous !== undefined && current !== previous
}
