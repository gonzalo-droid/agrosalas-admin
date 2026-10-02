import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { payments } from '../db/schema'
import { ApiError, notFound } from '../lib/errors'
import { validate } from '../lib/validate'
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES, evidencePath, type EvidenceContentType } from '../payroll/evidence'
import { findOpenPayroll, findPayrollMember } from '../payroll/open-payroll'
import type { AppEnv, Dependencies } from '../types'

const uploadInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  contentType: z.enum(Object.keys(EVIDENCE_TYPES) as [EvidenceContentType, ...EvidenceContentType[]], {
    message: 'Formato no permitido: usa JPG, PNG, WebP o PDF',
  }),
  sizeBytes: z.number().int().min(1).max(EVIDENCE_MAX_BYTES, { message: 'El archivo no puede pasar de 5 MB' }),
})
const readQuery = z.object({ paymentId: z.uuid() })

const READ_URL_SECONDS = 60

export const evidenceRoutes = ({ db, evidence }: Dependencies) =>
  new Hono<AppEnv>()
    .post('/upload-url', requireRole('admin', 'accounting'), validate('json', uploadInput), async (c) => {
      const { payrollId, workerId, contentType } = c.req.valid('json')
      await db.transaction(async (tx) => {
        await findOpenPayroll(tx, payrollId, 'share')
        await findPayrollMember(tx, payrollId, workerId)
      })
      // Nothing is written here: the payment that takes the file is what gets recorded.
      const path = evidencePath(payrollId, workerId, randomUUID(), contentType)
      const { signedUrl, token } = await evidence.createUploadUrl(path)
      return c.json({ path, token, signedUrl })
    })
    .get('/read-url', requireRole('admin', 'accounting', 'management'), validate('query', readQuery), async (c) => {
      const { paymentId } = c.req.valid('query')
      const [payment] = await db.select({ evidencePath: payments.evidencePath }).from(payments).where(eq(payments.id, paymentId))
      if (!payment) throw notFound('El pago')
      if (!payment.evidencePath) throw new ApiError(404, 'not_found', 'El pago no tiene evidencia')
      const { signedUrl } = await evidence.createReadUrl(payment.evidencePath, READ_URL_SECONDS)
      return c.json({ url: signedUrl, expiresIn: READ_URL_SECONDS })
    })
