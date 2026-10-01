// Decide, ante un aviso de Supabase Auth, si los datos guardados en memoria ya no son de quien está usando la pestaña.
// `anterior` es undefined hasta el primer aviso (INITIAL_SESSION), que solo sirve para anotar quién está.
export function hayQueVaciarCache(evento: string, anterior: string | null | undefined, actual: string | null) {
  if (evento === 'SIGNED_OUT') return true
  return anterior !== undefined && actual !== anterior
}
