import Anthropic from '@anthropic-ai/sdk'
import { eq } from 'drizzle-orm'
import { McpSession } from '../mcp-client/session.js'
import { runs, turns } from '../db/schema.js'
import type { RunEvent, RunnerOptions } from './types.js'

export async function* runScenario(opts: RunnerOptions): AsyncGenerator<RunEvent> {
  const {
    run,
    scenario,
    serverConfig,
    discoveredSchema,
    db,
    anthropicApiKey,
    maxTurns = 10,
  } = opts

  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  // Convert discovered MCP tools to Anthropic tool definitions
  const tools: Anthropic.Tool[] = discoveredSchema.tools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }))

  // Update run status to running
  await db
    .update(runs)
    .set({ status: 'running' })
    .where(eq(runs.id, run.id))

  yield { type: 'run_started', runId: run.id }

  let session: McpSession | null = null
  let turnCount = 0

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: scenario.userPrompt },
  ]

  try {
    session = await McpSession.create(serverConfig)

    for (let turnIndex = 0; turnIndex < maxTurns; turnIndex++) {
      yield { type: 'turn_started', runId: run.id, turnIndex }

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: scenario.systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      })

      yield { type: 'assistant_delta', runId: run.id, turnIndex, content: response.content }

      // Collect tool_use blocks
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      )

      const turnToolCalls: Array<{ id: string; name: string; input: unknown }> = []
      const turnToolResults: Array<{ id: string; content: unknown; isError: boolean }> = []
      const toolResultMessages: Anthropic.ToolResultBlockParam[] = []

      for (const block of toolUseBlocks) {
        yield {
          type: 'tool_call',
          runId: run.id,
          turnIndex,
          toolUseId: block.id,
          toolName: block.name,
          toolInput: block.input,
        }

        turnToolCalls.push({ id: block.id, name: block.name, input: block.input })

        const callResult = await session.callTool(
          block.name,
          block.input as Record<string, unknown>,
        )

        yield {
          type: 'tool_result',
          runId: run.id,
          turnIndex,
          toolUseId: block.id,
          toolName: block.name,
          result: callResult.content,
          isError: callResult.isError,
        }

        turnToolResults.push({
          id: block.id,
          content: callResult.content,
          isError: callResult.isError,
        })

        toolResultMessages.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(callResult.content),
          is_error: callResult.isError,
        })
      }

      // Persist turn to DB
      await db.insert(turns).values({
        id: crypto.randomUUID(),
        runId: run.id,
        index: turnIndex,
        assistantMessage: response.content,
        toolCalls: turnToolCalls,
        toolResults: turnToolResults,
        createdAt: new Date(),
      })

      turnCount = turnIndex + 1
      yield { type: 'turn_saved', runId: run.id, turnIndex }

      // No tool use blocks means the agent is done
      if (toolUseBlocks.length === 0) {
        break
      }

      // Append assistant message and tool results for next loop iteration
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: toolResultMessages })
    }

    await session.close()
    session = null

    await db
      .update(runs)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(runs.id, run.id))

    yield { type: 'run_completed', runId: run.id, turnCount }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    try {
      await session?.close()
    } catch {
      // ignore close errors
    }

    await db
      .update(runs)
      .set({ status: 'failed', error: message, completedAt: new Date() })
      .where(eq(runs.id, run.id))

    yield { type: 'run_failed', runId: run.id, error: message }
  }
}
