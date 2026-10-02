import { createClient } from '@supabase/supabase-js'
import { ApiError } from '../lib/errors'
import type { EvidenceStorage } from '../types'

const failed = () => new ApiError(502, 'storage_error', 'No se pudo preparar la evidencia; inténtalo de nuevo')

// The private bucket of payment evidence. The backend never handles the file: it only signs short-lived URLs.
export function createSupabaseEvidenceStorage(supabaseUrl: string, secretKey: string, bucket: string): EvidenceStorage {
  const storage = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket)
  return {
    async createUploadUrl(path) {
      const { data, error } = await storage.createSignedUploadUrl(path)
      if (error || !data) {
        console.error('Evidence upload URL failed:', error?.message)
        throw failed()
      }
      return { signedUrl: data.signedUrl, token: data.token }
    },
    async createReadUrl(path, expiresInSeconds) {
      const { data, error } = await storage.createSignedUrl(path, expiresInSeconds)
      if (error || !data) {
        console.error('Evidence read URL failed:', error?.message)
        throw failed()
      }
      return { signedUrl: data.signedUrl }
    },
  }
}
