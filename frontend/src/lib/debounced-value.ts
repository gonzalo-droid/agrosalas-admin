'use client'

import { useEffect, useState } from 'react'

// Returns `value` delayed by `ms`: it avoids sending a request
// to the API for every key typed in a search box.
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])

  return debounced
}
