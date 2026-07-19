import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDbReady, runs, turns } from '@mcp-test-bench/core'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: runId } = await params
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const run = await db.select().from(runs).where(eq(runs.id, runId)).get()
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const runTurns = await db
      .select()
      .from(turns)
      .where(eq(turns.runId, runId))
      .orderBy(turns.index)
      .all()

    return NextResponse.json({ run, turns: runTurns })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
