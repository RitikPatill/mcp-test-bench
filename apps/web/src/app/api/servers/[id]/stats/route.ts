import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { getDbReady, runs, judgements, findings } from '@mcp-test-bench/core'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    // Latest judgement score
    const latestJudgement = await db
      .select({ overallScore: judgements.overallScore, createdAt: judgements.createdAt })
      .from(judgements)
      .leftJoin(runs, eq(judgements.runId, runs.id))
      .where(eq(runs.serverId, id))
      .orderBy(desc(judgements.createdAt))
      .limit(1)
      .all()

    const latestScore =
      latestJudgement.length > 0 ? latestJudgement[0]!.overallScore / 100 : null

    // Sparkline: last 10 judgements ASC
    const sparklineRows = await db
      .select({ overallScore: judgements.overallScore, createdAt: judgements.createdAt })
      .from(judgements)
      .leftJoin(runs, eq(judgements.runId, runs.id))
      .where(eq(runs.serverId, id))
      .orderBy(desc(judgements.createdAt))
      .limit(10)
      .all()

    const sparkline = sparklineRows
      .reverse()
      .map((row) => ({
        score: row.overallScore / 100,
        date:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt as number).toISOString(),
      }))

    // Run counts
    const runRows = await db
      .select({ status: runs.status })
      .from(runs)
      .where(eq(runs.serverId, id))
      .all()

    const totalRuns = runRows.length
    const completedRuns = runRows.filter((r) => r.status === 'completed').length
    const passRate = totalRuns > 0 ? completedRuns / totalRuns : 0

    // Finding counts
    const findingRows = await db
      .select({ severity: findings.severity })
      .from(findings)
      .where(eq(findings.serverId, id))
      .all()

    const findingCounts = { critical: 0, warn: 0, info: 0 }
    for (const f of findingRows) {
      if (f.severity === 'critical') findingCounts.critical++
      else if (f.severity === 'warn') findingCounts.warn++
      else if (f.severity === 'info') findingCounts.info++
    }

    return NextResponse.json({ latestScore, sparkline, totalRuns, passRate, findingCounts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
