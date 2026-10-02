// The same limits as the API and the bucket.
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const EVIDENCE_ACCEPT = TYPES.join(',')
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 1600

export const isImage = (type: string): boolean => type.startsWith('image/')

export function evidenceProblem(file: { type: string; size: number }): string | null {
  if (!TYPES.includes(file.type)) return 'Formato no permitido: usa JPG, PNG, WebP o PDF'
  if (file.size === 0) return 'El archivo está vacío'
  if (file.size > EVIDENCE_MAX_BYTES) return 'El archivo no puede pasar de 5 MB'
  return null
}

// The size of a photo reduced so that its longest side is at most 1600 px. A smaller one is left as it is.
export function scaledSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}
