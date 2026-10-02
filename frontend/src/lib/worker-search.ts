// What the worker search shows instead of its list. Pure: the picker only draws it.

export const MIN_LETTERS = 2

export type SearchStatus = 'short' | 'searching' | 'failed' | 'none' | 'taken'

// The text of each status; a failed search shows the error with its retry button instead.
export const SEARCH_STATUS_TEXT: Record<Exclude<SearchStatus, 'failed'>, string> = {
  short: `Escribe al menos ${MIN_LETTERS} letras`,
  searching: 'Buscando…',
  none: 'Sin resultados',
  taken: 'Ya están elegidos',
}

export const MORE_RESULTS_TEXT = 'Hay más resultados: escribe más letras.'

// `found` is how many workers the search returned; `offered` is how many of those can still be chosen (the rest are
// already chosen or excluded). "No results" is only for a search that returned nothing.
export function searchStatus(input: { textLength: number; searching: boolean; failed: boolean; found: number; offered: number }): SearchStatus | null {
  if (input.textLength < MIN_LETTERS) return 'short'
  if (input.searching) return 'searching'
  if (input.failed) return 'failed'
  if (input.found === 0) return 'none'
  if (input.offered === 0) return 'taken'
  return null
}

// The API has more workers than the page it sent: the list shown is not everything the text matches.
export const hasMoreResults = (total: number, found: number): boolean => total > found
