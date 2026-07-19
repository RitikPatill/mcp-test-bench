'use client'

import dynamic from 'next/dynamic'
import type { Judgement } from '@mcp-test-bench/core'

// Recharts is browser-only — load without SSR
const RadarChart = dynamic(() => import('recharts').then((m) => m.RadarChart), { ssr: false })
const PolarGrid = dynamic(() => import('recharts').then((m) => m.PolarGrid), { ssr: false })
const PolarAngleAxis = dynamic(() => import('recharts').then((m) => m.PolarAngleAxis), { ssr: false })
const PolarRadiusAxis = dynamic(() => import('recharts').then((m) => m.PolarRadiusAxis), { ssr: false })
const Radar = dynamic(() => import('recharts').then((m) => m.Radar), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

interface JudgePanelProps {
  judgement: Judgement | null
}

function scoreColor(score: number): string {
  if (score >= 7) return 'text-green-600'
  if (score >= 5) return 'text-yellow-600'
  return 'text-red-600'
}

function scoreBadgeColor(score: number): string {
  if (score >= 7) return 'bg-green-100 text-green-800'
  if (score >= 5) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

export function JudgePanel({ judgement }: JudgePanelProps) {
  if (!judgement) {
    return (
      <div className="rounded border bg-gray-50 p-6 text-center text-sm text-gray-400">
        Awaiting judgement…
      </div>
    )
  }

  const radarData = judgement.criteriaScores.map((cs) => ({
    criterion: cs.name,
    score: cs.score,
  }))

  return (
    <section className="space-y-4 rounded border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">LLM Judge</h2>
        <span className={`text-3xl font-bold tabular-nums ${scoreColor(judgement.overallScore)}`}>
          {judgement.overallScore.toFixed(1)}&thinsp;
          <span className="text-base font-normal text-gray-400">/ 10</span>
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="75%">
            <PolarGrid />
            <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} tickCount={6} />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <dl className="space-y-4">
        {judgement.criteriaScores.map((cs) => (
          <div key={cs.name} className="space-y-1">
            <div className="flex items-center gap-2">
              <dt className="font-medium capitalize">{cs.name.replace(/_/g, ' ')}</dt>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${scoreBadgeColor(cs.score)}`}
              >
                {cs.score} / 10
              </span>
            </div>
            <dd className="text-sm text-gray-600">{cs.reasoning}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-gray-400">
        Rubric: <span className="font-mono">{judgement.rubricId}</span> &middot; Judged at{' '}
        {new Date(judgement.createdAt).toLocaleString()}
      </p>
    </section>
  )
}
