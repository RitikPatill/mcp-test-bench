import { NextResponse } from 'next/server'
import { z } from 'zod'
import { discoverServer, getDbReady, servers } from '@mcp-test-bench/core'

const stdioConfigSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

const sseConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
})

const bodySchema = z.object({
  name: z.string().min(1),
  config: z.discriminatedUnion('type', [stdioConfigSchema, sseConfigSchema]),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { name, config } = parsed.data

    const discoveredSchema = await discoverServer(config)

    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const id = crypto.randomUUID()
    const createdAt = new Date()

    await db.insert(servers).values({
      id,
      name,
      config,
      discoveredSchema,
      createdAt,
    })

    const row = {
      id,
      name,
      config,
      discoveredSchema,
      createdAt: createdAt.toISOString(),
    }

    return NextResponse.json(row, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
