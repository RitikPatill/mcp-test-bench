import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getDbReady, servers, scenarios, runs, turns as turnsTable, runScenario, judgeRun, BUILTIN_RUBRICS } from '@mcp-test-bench/core'
import { publish } from '@/lib/run-broker'

const bodySchema = z.object({
  scenarioId: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = bodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { scenarioId } = parsed.data
    const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

    const scenario = await db.select().from(scenarios).where(eq(scenarios.id, scenarioId)).get()
    if (!scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 })
    }

    const server = await db.select().from(servers).where(eq(servers.id, scenario.serverId)).get()
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    if (!server.discoveredSchema) {
      return NextResponse.json({ error: 'Server has no discovered schema' }, { status: 400 })
    }

    const runId = crypto.randomUUID()
    const createdAt = new Date()

    await db.insert(runs).values({
      id: runId,
      scenarioId,
      serverId: server.id,
      status: 'pending',
      createdAt,
    })

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
    }

    // Fire and forget — events stream via SSE
    void (async () => {
      for await (const event of runScenario({
        run: { id: runId, scenarioId, serverId: server.id },
        scenario: { systemPrompt: scenario.systemPrompt, userPrompt: scenario.userPrompt },
        serverConfig: server.config,
        discoveredSchema: server.discoveredSchema!,
        db,
        anthropicApiKey,
      })) {
        publish(runId, event)
      }

      // After the run completes, invoke the LLM judge
      try {
        const runTurns = await db.select().from(turnsTable).where(eq(turnsTable.runId, runId)).all()
        await judgeRun({
          run: { id: runId },
          scenario: {
            systemPrompt: scenario.systemPrompt,
            userPrompt: scenario.userPrompt,
            expectedCriteria: scenario.expectedCriteria,
          },
          turns: runTurns,
          rubric: BUILTIN_RUBRICS['general'],
          db,
          anthropicApiKey,
        })
      } catch (_err) {
        // Judge failure must not affect the already-completed run record
      }
    })()

    return NextResponse.json({ runId }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
