import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { getDbReady, servers, runs, judgements, findings } from '@mcp-test-bench/core'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids') ?? ''
    const ids = idsParam.split(',').filter(Boolean)

    if (ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 server IDs required' },
        { status: 400 },
      )
    }

    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const results = await Promise.all(
      ids.map(async (id) => {
        const server = await db.select().from(servers).where(eq(servers.id, id)).get()
        if (!server) return null

        // Latest judgement
        const latestJudgement = await db
          .select({
            overallScore: judgements.overallScore,
            criteriaScores: judgements.criteriaScores,
          })
          .from(judgements)
          .leftJoin(runs, eq(judgements.runId, runs.id))
          .where(eq(runs.serverId, id))
          .orderBy(desc(judgements.createdAt))
          .limit(1)
          .get()

        const latestScore = latestJudgement ? latestJudgement.overallScore / 100 : null
        const criteriaScores = latestJudgement?.criteriaScores
          ? (latestJudgement.criteriaScores as Array<{ name: string; score: number; reasoning: string }>).map(
              (c) => ({ ...c, score: c.score / 10 }),
            )
          : null

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

        return {
          id: server.id,
          name: server.name,
          latestScore,
          criteriaScores,
          findingCounts,
          totalRuns,
          passRate,
        }
      }),
    )

    const valid = results.filter(Boolean)
    return NextResponse.json(valid)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
