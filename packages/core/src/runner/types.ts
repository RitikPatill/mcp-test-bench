import type Anthropic from '@anthropic-ai/sdk'
import type { ServerConfig, DiscoveredSchema } from '../mcp-client/types.js'
import type { DrizzleDb } from '../db/index.js'

export type RunEvent =
  | { type: 'run_started'; runId: string }
  | { type: 'turn_started'; runId: string; turnIndex: number }
  | { type: 'assistant_delta'; runId: string; turnIndex: number; content: Anthropic.ContentBlock[] }
  | {
      type: 'tool_call'
      runId: string
      turnIndex: number
      toolUseId: string
      toolName: string
      toolInput: unknown
    }
  | {
      type: 'tool_result'
      runId: string
      turnIndex: number
      toolUseId: string
      toolName: string
      result: unknown
      isError: boolean
    }
  | { type: 'turn_saved'; runId: string; turnIndex: number }
  | { type: 'run_completed'; runId: string; turnCount: number }
  | { type: 'run_failed'; runId: string; error: string }

export interface RunnerOptions {
  run: { id: string; scenarioId: string; serverId: string }
  scenario: { systemPrompt: string; userPrompt: string }
  serverConfig: ServerConfig
  discoveredSchema: DiscoveredSchema
  db: DrizzleDb
  anthropicApiKey: string
  maxTurns?: number
}
