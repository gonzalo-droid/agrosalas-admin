/** Trim, collapse spaces, upper case, and exactly one space after the comma. */
export const normalizeName = (raw: string): string =>
  raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .toUpperCase()

export const splitName = (normalized: string): { lastName: string; firstName: string } => {
  const comma = normalized.indexOf(',')
  if (comma === -1) return { lastName: normalized, firstName: '' }
  return {
    lastName: normalized.slice(0, comma).trim(),
    firstName: normalized.slice(comma + 1).trim(),
  }
}

/**
 * Names the workbook writes in a way that normalising alone does not unify (normalized → normalized). Empty on
 * purpose: aliases are real people's names, so they only come from a `--aliases` file kept outside the repository.
 */
export const DEFAULT_ALIASES: Record<string, string> = {}

export const applyAlias = (normalized: string, aliases: Record<string, string>): string =>
  Object.hasOwn(aliases, normalized) ? aliases[normalized]! : normalized

/** The alias keys that match no name as written in the sheets (normalised): a typo in the file, most likely. */
export const unusedAliases = (aliases: Record<string, string>, rawNames: string[]): string[] => {
  const written = new Set(rawNames.map(normalizeName))
  return Object.keys(aliases).filter((key) => !written.has(key))
}

const DNI_ALIAS = /^dni:(\d{8})$/

/** The DNI of an alias value `dni:<8 digits>`, which points a name at an existing worker; null for a name. */
export const aliasDni = (name: string): string | null => DNI_ALIAS.exec(name)?.[1] ?? null

/**
 * Reads the JSON of an aliases file: `{ "name as written": "unified name" | "dni:<8 digits>" }`. Names are normalised
 * like the sheet names; a DNI value is kept as `dni:<digits>`.
 */
export function parseAliases(json: unknown): Record<string, string> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error('El archivo de alias debe ser un objeto JSON { "nombre": "nombre unificado" o "dni:<8 dígitos>" }.')
  }
  const aliases: Record<string, string> = {}
  for (const [raw, unified] of Object.entries(json)) {
    if (typeof unified !== 'string') throw new Error(`El alias de "${raw}" debe ser un texto.`)
    const dni = /^\s*dni\s*:\s*(.*?)\s*$/i.exec(unified)
    if (dni && !/^\d{8}$/.test(dni[1]!)) throw new Error(`El alias de "${raw}" debe ser "dni:" seguido de 8 dígitos.`)
    aliases[normalizeName(raw)] = dni ? `dni:${dni[1]}` : normalizeName(unified)
  }
  return aliases
}

/** NFD and drop the combining marks: "PÉREZ MUÑOZ" → "PEREZ MUNOZ". */
export const foldAccents = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** The key two names are matched by: normalised, without accents, surnames alone when there is no given name. */
export const nameKey = (lastName: string, firstName: string): string => {
  const last = normalizeName(lastName)
  const first = normalizeName(firstName)
  return foldAccents(first === '' ? last : `${last}, ${first}`)
}

/** The key of a parsed worker name: a DNI alias is its own key, a name is keyed like a stored worker. */
export const workerKey = (name: string): string => {
  if (aliasDni(name) !== null) return name
  const { lastName, firstName } = splitName(name)
  return nameKey(lastName, firstName)
}

/**
 * Pairs of distinct names that may be the same person: same surnames, and the words of one given
 * name all appear in the other ("LUIS" / "JOSE LUIS"). Different given names alone do not pair.
 */
export function similarNames(names: string[]): [string, string][] {
  const unique = [...new Set(names)]
  const parsed = unique.map((name) => {
    const { lastName, firstName } = splitName(name)
    return { name, lastName, words: new Set(firstName.split(' ').filter(Boolean)) }
  })
  const contains = (outer: Set<string>, inner: Set<string>) => [...inner].every((w) => outer.has(w))

  const pairs: [string, string][] = []
  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const a = parsed[i]!
      const b = parsed[j]!
      if (a.lastName !== b.lastName || a.words.size === 0 || b.words.size === 0) continue
      if (contains(a.words, b.words) || contains(b.words, a.words)) pairs.push([a.name, b.name])
    }
  }
  return pairs
}
