import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MCP Test Bench',
  description: 'Evaluation harness for Model Context Protocol servers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto max-w-5xl flex items-center justify-between px-8 py-3">
              <span className="text-sm font-semibold text-foreground">MCP Test Bench</span>
              <DarkModeToggle />
            </div>
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
