import { NextResponse } from 'next/server'
import { eq, desc, asc } from 'drizzle-orm'
import {
  getDbReady,
  servers,
  runs,
  turns,
  findings,
  scanServer,
} from '@mcp-test-bench/core'

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warn: 1, info: 2 }

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const rows = await db
      .select()
      .from(findings)
      .where(eq(findings.serverId, id))
      .orderBy(asc(findings.createdAt))
      .all()

    // Sort: critical first, then warn, then info, then by createdAt desc
    const sorted = rows.sort((a, b) => {
      const sevDiff =
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
      if (sevDiff !== 0) return sevDiff
      return (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime()
    })

    return NextResponse.json(sorted)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const server = await db.select().from(servers).where(eq(servers.id, id)).get()
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    if (!server.discoveredSchema) {
      return NextResponse.json(
        { error: 'Server has not been discovered yet. Run discovery first.' },
        { status: 400 },
      )
    }

    // Fetch the latest completed run's turns for runtime scanning
    const latestRun = await db
      .select()
      .from(runs)
      .where(eq(runs.serverId, id))
      .orderBy(desc(runs.completedAt))
      .limit(1)
      .all()
      .then((rows) => rows.find((r) => r.status === 'completed') ?? null)

    let runTurns: Array<{
      index: number
      toolCalls: Array<{ id: string; name: string; input: unknown }>
      toolResults: Array<{ id: string; content: unknown; isError: boolean }>
    }> | undefined

    if (latestRun) {
      const turnRows = await db
        .select()
        .from(turns)
        .where(eq(turns.runId, latestRun.id))
        .orderBy(asc(turns.index))
        .all()

      runTurns = turnRows.map((t) => ({
        index: t.index,
        toolCalls: t.toolCalls as Array<{ id: string; name: string; input: unknown }>,
        toolResults: t.toolResults as Array<{
          id: string
          content: unknown
          isError: boolean
        }>,
      }))
    }

    const result = await scanServer({
      serverId: id,
      discoveredSchema: server.discoveredSchema,
      turns: runTurns,
      db,
    })

    return NextResponse.json({
      findings: result.findings,
      scannedAt: result.scannedAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
