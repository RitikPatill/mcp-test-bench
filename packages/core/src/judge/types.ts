import type { DrizzleDb } from '../db/index.js'
import type Anthropic from '@anthropic-ai/sdk'

export interface Criterion {
  name: string
  weight: number
  description: string
  scoringGuide: string
}

export interface Rubric {
  id: string
  name: string
  description: string
  criteria: Criterion[]
}

export interface CriterionScore {
  name: string
  score: number
  reasoning: string
}

export interface Judgement {
  id: string
  runId: string
  rubricId: string
  overallScore: number
  criteriaScores: CriterionScore[]
  createdAt: Date
}

export interface JudgeOptions {
  run: { id: string }
  scenario: { systemPrompt: string; userPrompt: string; expectedCriteria: string[] }
  turns: Array<{
    index: number
    assistantMessage: Anthropic.ContentBlock[]
    toolCalls: Array<{ id: string; name: string; input: unknown }>
    toolResults: Array<{ id: string; content: unknown; isError: boolean }>
  }>
  rubric: Rubric
  db: DrizzleDb
  anthropicApiKey: string
}
