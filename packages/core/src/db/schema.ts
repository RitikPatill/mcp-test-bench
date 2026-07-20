import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { ServerConfig, DiscoveredSchema } from '../mcp-client/types.js'
import type { ScenarioTag } from '../generator/types.js'
import type Anthropic from '@anthropic-ai/sdk'

// Inline to avoid circular import with judge/types.ts
type DbCriterionScore = Array<{ name: string; score: number; reasoning: string }>

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
  tag: text('tag').$type<ScenarioTag>().notNull().default('happy-path'),
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

// overallScore is stored as integer 0–1000 (score × 100) to avoid float imprecision.
// Divide by 100 when reading to restore the 0–10 scale.
export const judgements = sqliteTable('judgements', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  rubricId: text('rubric_id').notNull(),
  overallScore: integer('overall_score').notNull(),
  criteriaScores: text('criteria_scores', { mode: 'json' })
    .$type<DbCriterionScore>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})
