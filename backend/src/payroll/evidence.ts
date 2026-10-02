export const EVIDENCE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const
export type EvidenceContentType = keyof typeof EVIDENCE_TYPES

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024

const prefixOf = (payrollId: string, workerId: string) => `payrolls/${payrollId}/${workerId}/`

// Where the evidence of a payment lives in the bucket: one folder per payroll and worker.
export const evidencePath = (payrollId: string, workerId: string, fileId: string, contentType: EvidenceContentType): string =>
  `${prefixOf(payrollId, workerId)}${fileId}.${EVIDENCE_TYPES[contentType]}`

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/

// A payment can only point to a file of its own payroll and worker, with a name this API generated.
export function isEvidencePathOf(path: string, payrollId: string, workerId: string): boolean {
  const prefix = prefixOf(payrollId, workerId)
  return path.startsWith(prefix) && FILE_NAME.test(path.slice(prefix.length))
}
