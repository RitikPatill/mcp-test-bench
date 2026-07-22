'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RunFilter } from '@/components/run-filter'

interface RunRow {
  id: string
  status: string
  createdAt: number | string
  completedAt: number | string | null
  scenarioId: string
  tag: string | null
  scenarioUserPrompt: string | null
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const TAG_COLORS: Record<string, string> = {
  'happy-path': 'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  edge: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  adversarial: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

function formatDuration(start: number | string, end: number | string | null): string {
  if (!end) return '—'
  const startMs = typeof start === 'number' ? start * 1000 : new Date(start).getTime()
  const endMs = typeof end === 'number' ? end * 1000 : new Date(end).getTime()
  const diffSec = Math.round((endMs - startMs) / 1000)
  if (diffSec < 60) return `${diffSec}s`
  return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s`
}

function formatDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleString()
}

interface ServerRunsListProps {
  serverId: string
}

export function ServerRunsList({ serverId }: ServerRunsListProps) {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ tag: '', status: '' })

  const fetchRuns = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.tag) params.set('tag', filters.tag)
      if (filters.status) params.set('status', filters.status)
      const res = await fetch(`/api/servers/${serverId}/runs?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRuns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, filters.tag, filters.status])

  return (
    <div className="space-y-4">
      <RunFilter
        tag={filters.tag}
        status={filters.status}
        onChange={setFilters}
      />

      {loading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}{' '}
          <button onClick={fetchRuns} className="underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && runs.length === 0 && (
        <div className="rounded border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>No runs yet. Select a scenario above and click Run Eval.</p>
        </div>
      )}

      {!loading && !error && runs.length > 0 && (
        <div className="rounded border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Tag</th>
                <th className="px-4 py-2">Scenario</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {run.tag && (
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-semibold ${TAG_COLORS[run.tag] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {run.tag}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 max-w-xs truncate text-muted-foreground">
                    {run.scenarioUserPrompt ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDate(run.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {formatDuration(run.createdAt, run.completedAt)}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
