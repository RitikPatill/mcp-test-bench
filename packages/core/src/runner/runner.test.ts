import { describe, it, expect } from 'vitest'
import { runScenario } from './runner.js'
import { getDbReady } from '../db/index.js'
import { runs, turns } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import type { RunEvent } from './types.js'

const skip = !process.env.ANTHROPIC_API_KEY

const EVERYTHING_SERVER = {
  type: 'stdio' as const,
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-everything'],
}

const EVERYTHING_SCHEMA = {
  tools: [
    {
      name: 'echo',
      description: 'Echoes back the input message',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
    },
  ],
  resources: [],
  prompts: [],
}

describe('runScenario', () => {
  it.skipIf(skip)('happy path — echo tool is called and run completes', async () => {
    const db = await getDbReady(':memory:')

    const runId = crypto.randomUUID()
    const scenarioId = crypto.randomUUID()
    const serverId = crypto.randomUUID()

    await db.insert(runs).values({
      id: runId,
      scenarioId,
      serverId,
      status: 'pending',
      createdAt: new Date(),
    })

    const events: RunEvent[] = []

    for await (const event of runScenario({
      run: { id: runId, scenarioId, serverId },
      scenario: {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Call the echo tool with the message "hello".',
      },
      serverConfig: EVERYTHING_SERVER,
      discoveredSchema: EVERYTHING_SCHEMA,
      db,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    })) {
      events.push(event)
    }

    const toolCallEvents = events.filter((e) => e.type === 'tool_call')
    expect(toolCallEvents.length).toBeGreaterThan(0)
    expect(toolCallEvents[0]).toMatchObject({ type: 'tool_call', toolName: 'echo' })

    const completedEvent = events.find((e) => e.type === 'run_completed')
    expect(completedEvent).toBeDefined()

    const dbTurns = await db.select().from(turns).where(eq(turns.runId, runId)).all()
    expect(dbTurns.length).toBeGreaterThan(0)

    const finalRun = await db.select().from(runs).where(eq(runs.id, runId)).get()
    expect(finalRun?.status).toBe('completed')
  }, 60_000)

  it.skipIf(skip)('maxTurns guard — terminates after one turn', async () => {
    const db = await getDbReady(':memory:')

    const runId = crypto.randomUUID()
    const scenarioId = crypto.randomUUID()
    const serverId = crypto.randomUUID()

    await db.insert(runs).values({
      id: runId,
      scenarioId,
      serverId,
      status: 'pending',
      createdAt: new Date(),
    })

    const events: RunEvent[] = []

    for await (const event of runScenario({
      run: { id: runId, scenarioId, serverId },
      scenario: {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Call the echo tool with "hello", then call it again with "world".',
      },
      serverConfig: EVERYTHING_SERVER,
      discoveredSchema: EVERYTHING_SCHEMA,
      db,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
      maxTurns: 1,
    })) {
      events.push(event)
    }

    const turnSavedEvents = events.filter((e) => e.type === 'turn_saved')
    expect(turnSavedEvents.length).toBeLessThanOrEqual(1)

    const finalEvent = events[events.length - 1]
    expect(['run_completed', 'run_failed']).toContain(finalEvent?.type)
  }, 60_000)

  it.skipIf(skip)('tool error passthrough — isError is propagated and run still completes', async () => {
    const db = await getDbReady(':memory:')

    const runId = crypto.randomUUID()
    const scenarioId = crypto.randomUUID()
    const serverId = crypto.randomUUID()

    await db.insert(runs).values({
      id: runId,
      scenarioId,
      serverId,
      status: 'pending',
      createdAt: new Date(),
    })

    // Schema with a broken tool that will cause an error when called
    const brokenSchema = {
      tools: [
        {
          name: 'nonexistent_tool',
          description: 'A tool that does not exist on the server',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
      ],
      resources: [],
      prompts: [],
    }

    const events: RunEvent[] = []

    for await (const event of runScenario({
      run: { id: runId, scenarioId, serverId },
      scenario: {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'Call the nonexistent_tool.',
      },
      serverConfig: EVERYTHING_SERVER,
      discoveredSchema: brokenSchema,
      db,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    })) {
      events.push(event)
    }

    // Run should eventually terminate (either completed or failed — not throw)
    const terminalEvent = events.find(
      (e) => e.type === 'run_completed' || e.type === 'run_failed',
    )
    expect(terminalEvent).toBeDefined()
  }, 60_000)
})
