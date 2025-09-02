import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
// Coby assistant removed from global layout per admin request
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Coby Picks',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            {children}
            {/* Coby assistant removed from global layout per admin request */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
