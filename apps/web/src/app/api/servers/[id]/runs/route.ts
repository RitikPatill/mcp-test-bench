import { NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { getDbReady, runs, scenarios } from '@mcp-test-bench/core'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const tagFilter = searchParams.get('tag') ?? ''
    const statusFilter = searchParams.get('status') ?? ''

    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const rows = await db
      .select({
        id: runs.id,
        status: runs.status,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
        scenarioId: runs.scenarioId,
        tag: scenarios.tag,
        scenarioUserPrompt: scenarios.userPrompt,
      })
      .from(runs)
      .leftJoin(scenarios, eq(runs.scenarioId, scenarios.id))
      .where(eq(runs.serverId, id))
      .orderBy(desc(runs.createdAt))
      .limit(50)
      .all()

    const filtered = rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (tagFilter && r.tag !== tagFilter) return false
      return true
    })

    return NextResponse.json(filtered)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
