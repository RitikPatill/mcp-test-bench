'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface CriterionScore {
  name: string
  score: number
  reasoning: string
}

interface CompareServerData {
  id: string
  name: string
  latestScore: number | null
  criteriaScores: CriterionScore[] | null
  findingCounts: { critical: number; warn: number; info: number }
  totalRuns: number
  passRate: number
}

const PALETTE = ['#6366f1', '#f59e0b', '#10b981']

interface ComparisonChartProps {
  servers: CompareServerData[]
}

export function ComparisonChart({ servers }: ComparisonChartProps) {
  // Collect criterion names from first server that has criteriaScores
  const criteriaSource = servers.find((s) => s.criteriaScores && s.criteriaScores.length > 0)
  const criterionNames =
    criteriaSource?.criteriaScores?.map((c) => c.name) ?? ['Overall']

  // Build recharts data: one entry per criterion
  const chartData = criterionNames.map((criterion) => {
    const entry: Record<string, string | number> = { criterion }
    for (const server of servers) {
      if (criterion === 'Overall') {
        entry[server.name] = server.latestScore ?? 0
      } else {
        const cs = server.criteriaScores?.find((c) => c.name === criterion)
        entry[server.name] = cs ? cs.score : 0
      }
    }
    return entry
  })

  // If no criteria data, show overall
  const displayData =
    criteriaSource
      ? chartData
      : servers.map((s) => ({ criterion: 'Overall', [s.name]: s.latestScore ?? 0 }))

  return (
    <div className="space-y-6">
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <XAxis
              dataKey="criterion"
              tick={{ fontSize: 12, fill: 'var(--foreground)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 10]}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value: number) => value.toFixed(1)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {servers.map((server, i) => (
              <Bar
                key={server.id}
                dataKey={server.name}
                fill={PALETTE[i % PALETTE.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border rounded">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Server</th>
              <th className="px-3 py-2 font-medium">Overall</th>
              <th className="px-3 py-2 font-medium text-red-600">Critical</th>
              <th className="px-3 py-2 font-medium text-yellow-600">Warn</th>
              <th className="px-3 py-2 font-medium text-blue-600">Info</th>
              <th className="px-3 py-2 font-medium">Runs</th>
              <th className="px-3 py-2 font-medium">Pass Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {servers.map((server, i) => (
              <tr key={server.id}>
                <td className="px-3 py-2 font-medium flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  {server.name}
                </td>
                <td className="px-3 py-2">
                  {server.latestScore !== null ? server.latestScore.toFixed(1) : '—'}
                </td>
                <td className="px-3 py-2">{server.findingCounts.critical}</td>
                <td className="px-3 py-2">{server.findingCounts.warn}</td>
                <td className="px-3 py-2">{server.findingCounts.info}</td>
                <td className="px-3 py-2">{server.totalRuns}</td>
                <td className="px-3 py-2">{(server.passRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export type { CompareServerData, CriterionScore }
