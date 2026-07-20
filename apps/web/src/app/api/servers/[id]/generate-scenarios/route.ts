import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDbReady, servers, scenarios, generateScenarios } from '@mcp-test-bench/core'

const bodySchema = z.object({
  count: z.number().int().min(1).max(50).default(20),
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

    const { count } = parsed.data
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const server = await db.select().from(servers).where(eq(servers.id, serverId)).get()
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    if (!server.discoveredSchema) {
      return NextResponse.json(
        { error: 'Server has no discovered schema. Run discovery first.' },
        { status: 400 },
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 })
    }

    const generated = await generateScenarios({
      discoveredSchema: server.discoveredSchema,
      serverName: server.name,
      anthropicApiKey: apiKey,
      count,
    })

    const createdAt = new Date()
    const inserted = await Promise.all(
      generated.map(async (s) => {
        const id = crypto.randomUUID()
        await db.insert(scenarios).values({
          id,
          serverId,
          systemPrompt: s.systemPrompt,
          userPrompt: s.userPrompt,
          expectedCriteria: s.expectedCriteria,
          tag: s.tag,
          createdAt,
        })
        return { id, ...s, serverId, createdAt: createdAt.toISOString() }
      }),
    )

    return NextResponse.json({ generated: inserted.length, scenarios: inserted }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
