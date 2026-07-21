import Link from 'next/link'
import { Suspense } from 'react'
import { ComparisonChart } from '@/components/comparison-chart'
import type { CompareServerData } from '@/components/comparison-chart'

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>
}

async function CompareContent({ ids }: { ids: string[] }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/compare?ids=${ids.join(',')}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
        Failed to load comparison data: {err.error ?? res.statusText}
      </div>
    )
  }

  const servers: CompareServerData[] = await res.json()

  if (servers.length < 2) {
    return (
      <EmptyState message="Could not find enough valid servers. Please go back and select at least 2 existing servers." />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {servers.map((s) => (
          <Link
            key={s.id}
            href={`/servers/${s.id}`}
            className="text-sm text-primary hover:underline"
          >
            {s.name}
          </Link>
        ))}
      </div>
      <ComparisonChart servers={servers} />
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed p-12 text-center space-y-3">
      <p className="text-muted-foreground">{message}</p>
      <Link href="/" className="text-sm text-primary hover:underline">
        ← Back to servers
      </Link>
    </div>
  )
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const { ids: idsParam } = await searchParams
  const ids = (idsParam ?? '').split(',').filter(Boolean)

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Compare Servers</h1>
      </div>

      {ids.length < 2 ? (
        <EmptyState message="Select 2 or 3 servers from the home page using the checkboxes, then click Compare." />
      ) : (
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-64 rounded bg-muted animate-pulse" />
              <div className="h-32 rounded bg-muted animate-pulse" />
            </div>
          }
        >
          <CompareContent ids={ids} />
        </Suspense>
      )}
    </main>
  )
}
