import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { ServerConfig, DiscoveredSchema } from '../mcp-client/types.js'
import type Anthropic from '@anthropic-ai/sdk'

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<ServerConfig>().notNull(),
  discoveredSchema: text('discovered_schema', { mode: 'json' }).$type<DiscoveredSchema>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const scenarios = sqliteTable('scenarios', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  userPrompt: text('user_prompt').notNull(),
  expectedCriteria: text('expected_criteria', { mode: 'json' }).$type<string[]>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id').notNull(),
  serverId: text('server_id').notNull(),
  status: text('status').$type<'pending' | 'running' | 'completed' | 'failed'>().notNull(),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

export const turns = sqliteTable('turns', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  index: integer('index').notNull(),
  assistantMessage: text('assistant_message', { mode: 'json' })
    .$type<Anthropic.ContentBlock[]>()
    .notNull(),
  toolCalls: text('tool_calls', { mode: 'json' })
    .$type<Array<{ id: string; name: string; input: unknown }>>()
    .notNull(),
  toolResults: text('tool_results', { mode: 'json' })
    .$type<Array<{ id: string; content: unknown; isError: boolean }>>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
