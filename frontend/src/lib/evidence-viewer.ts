'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { api, errorMessage, unwrap } from './api'

// Opens the evidence of a payment in a new tab. `opening` is the id of the payment being opened, to disable its button.
export function useEvidenceViewer() {
  const [opening, setOpening] = useState<string | null>(null)

  // The tab is opened inside the click, before the request: a window opened after waiting is taken for a pop-up and blocked.
  async function open(paymentId: string) {
    const tab = window.open('', '_blank')
    setOpening(paymentId)
    try {
      const { url } = await unwrap(api.v1.evidence['read-url'].$get({ query: { paymentId } }))
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        toast.error('El navegador bloqueó la ventana. Permite las ventanas emergentes para ver la evidencia.')
      }
    } catch (e) {
      tab?.close()
      toast.error(errorMessage(e))
    } finally {
      setOpening(null)
    }
  }

  return { opening, open }
}
