import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDbReady, servers } from '@mcp-test-bench/core'

export async function GET(
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

    return NextResponse.json({
      id: server.id,
      name: server.name,
      config: server.config,
      discoveredSchema: server.discoveredSchema,
      createdAt: server.createdAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
