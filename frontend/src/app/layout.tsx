import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Agrosalas Admin', template: '%s · Agrosalas Admin' },
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
