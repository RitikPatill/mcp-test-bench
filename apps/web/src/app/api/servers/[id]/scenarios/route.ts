import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDbReady, servers, scenarios } from '@mcp-test-bench/core'

const bodySchema = z.object({
  systemPrompt: z.string().min(1),
  userPrompt: z.string().min(1),
  expectedCriteria: z.array(z.string()).optional().default([]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: serverId } = await params
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const serverRow = await db.select().from(servers).where(eq(servers.id, serverId)).get()
    if (!serverRow) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    const { systemPrompt, userPrompt, expectedCriteria } = parsed.data

    const id = crypto.randomUUID()
    const createdAt = new Date()

    await db.insert(scenarios).values({
      id,
      serverId,
      systemPrompt,
      userPrompt,
      expectedCriteria,
      createdAt,
    })

    return NextResponse.json(
      { id, serverId, systemPrompt, userPrompt, expectedCriteria, createdAt: createdAt.toISOString() },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
