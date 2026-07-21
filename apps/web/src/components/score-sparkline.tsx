'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklinePoint {
  score: number
  date: string
}

interface ScoreSparklineProps {
  data: SparklinePoint[]
}

export function ScoreSparkline({ data }: ScoreSparklineProps) {
  if (data.length === 0) {
    return (
      <span className="text-muted-foreground text-xs select-none">—</span>
    )
  }

  return (
    <div style={{ width: 80, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--primary, #6366f1)"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
