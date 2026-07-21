'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ScoreSparkline } from '@/components/score-sparkline'
import { CompareBar } from '@/components/compare-bar'

interface ServerStats {
  latestScore: number | null
  sparkline: { score: number; date: string }[]
  totalRuns: number
  passRate: number
  findingCounts: { critical: number; warn: number; info: number }
}

interface ServerRow {
  id: string
  name: string
  type: string
  toolCount: number | string
  scenarioCount: number
  createdAt: string
  stats: ServerStats | null
}

interface ServerTableProps {
  servers: ServerRow[]
}

export function ServerTable({ servers }: ServerTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  return (
    <>
      <div className={selectedIds.length > 0 ? 'pb-16' : ''}>
        <div className="rounded border bg-card shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Trend</th>
                <th className="px-4 py-3">Pass Rate</th>
                <th className="px-4 py-3">Findings</th>
                <th className="px-4 py-3">Tools</th>
                <th className="px-4 py-3">Scenarios</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {servers.map((s) => {
                const checked = selectedIds.includes(s.id)
                const stats = s.stats
                return (
                  <tr key={s.id} className={`hover:bg-muted/30 ${checked ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.id)}
                        aria-label={`Select ${s.name} for comparison`}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/servers/${s.id}`}
                        className="hover:underline text-primary"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{s.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {stats?.latestScore !== null && stats?.latestScore !== undefined ? (
                        <span className="font-mono font-semibold">
                          {stats.latestScore.toFixed(1)}
                          <span className="text-muted-foreground font-normal text-xs">/10</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreSparkline data={stats?.sparkline ?? []} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {stats ? `${(stats.passRate * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {stats ? (
                        <div className="flex gap-1 text-xs">
                          {stats.findingCounts.critical > 0 && (
                            <span className="rounded px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                              {stats.findingCounts.critical}C
                            </span>
                          )}
                          {stats.findingCounts.warn > 0 && (
                            <span className="rounded px-1.5 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 font-semibold">
                              {stats.findingCounts.warn}W
                            </span>
                          )}
                          {stats.findingCounts.info > 0 && (
                            <span className="rounded px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold">
                              {stats.findingCounts.info}I
                            </span>
                          )}
                          {stats.findingCounts.critical === 0 &&
                            stats.findingCounts.warn === 0 &&
                            stats.findingCounts.info === 0 && (
                              <span className="text-muted-foreground">—</span>
                            )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.toolCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.scenarioCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.createdAt}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CompareBar selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
    </>
  )
}
