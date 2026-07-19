import Anthropic from '@anthropic-ai/sdk'
import { judgements } from '../db/schema.js'
import type { Judgement, JudgeOptions, CriterionScore } from './types.js'

// Format the full run transcript into a readable string for the judge prompt.
export function formatTranscript(
  turns: JudgeOptions['turns'],
): string {
  if (turns.length === 0) return '(no turns recorded)'

  return turns
    .map((turn) => {
      const lines: string[] = [`TURN ${turn.index}:`]

      // Assistant text blocks
      for (const block of turn.assistantMessage) {
        if (block.type === 'text' && block.text.trim()) {
          lines.push(`  Assistant: ${block.text.trim()}`)
        }
      }

      // Tool calls
      for (const tc of turn.toolCalls) {
        lines.push(`  Tool call: ${tc.name}(${JSON.stringify(tc.input)})`)
      }

      // Tool results
      for (const tr of turn.toolResults) {
        const prefix = tr.isError ? '  Tool error' : '  Tool result'
        lines.push(`${prefix}: ${JSON.stringify(tr.content)}`)
      }

      return lines.join('\n')
    })
    .join('\n\n')
}

function buildRecordScoresTool(rubric: JudgeOptions['rubric']): Anthropic.Tool {
  return {
    name: 'record_scores',
    description:
      'Record the evaluation scores for each criterion in the rubric. You MUST call this tool.',
    input_schema: {
      type: 'object' as const,
      properties: {
        criteria_scores: {
          type: 'array',
          description: 'Scores for each criterion',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: `One of: ${rubric.criteria.map((c) => c.name).join(', ')}`,
              },
              score: {
                type: 'number',
                description: 'Score from 1 to 10 (inclusive)',
              },
              reasoning: {
                type: 'string',
                description: 'One or two sentences explaining this score',
              },
            },
            required: ['name', 'score', 'reasoning'],
          },
        },
      },
      required: ['criteria_scores'],
    },
  }
}

export async function judgeRun(opts: JudgeOptions): Promise<Judgement> {
  const { run, scenario, turns, rubric, db, anthropicApiKey } = opts

  const transcript = formatTranscript(turns)

  const criteriaBlock = rubric.criteria
    .map(
      (c) =>
        `**${c.name}** (weight ${c.weight})\n  ${c.description}\n  Scoring guide: ${c.scoringGuide}`,
    )
    .join('\n\n')

  const systemPrompt = `You are an impartial LLM judge evaluating an AI agent's interaction with an MCP (Model Context Protocol) server.

You will be given:
1. The original task (system prompt + user prompt)
2. A full transcript of what the agent did (turns, tool calls, results)
3. A rubric with weighted criteria

Your job is to score the agent's performance on each criterion from 1 (worst) to 10 (best), and provide a brief reasoning for each score.

## Rubric: ${rubric.name}
${rubric.description}

### Criteria
${criteriaBlock}

Be objective and consistent. Base your scores solely on the transcript provided.`

  const userMessage = `## Task
System prompt: ${scenario.systemPrompt}
User prompt: ${scenario.userPrompt}
Expected criteria: ${scenario.expectedCriteria.join(', ') || '(none specified)'}

## Agent Transcript
${transcript}

Please score the agent's performance using the record_scores tool.`

  const client = new Anthropic({ apiKey: anthropicApiKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: [buildRecordScoresTool(rubric)],
    tool_choice: { type: 'tool', name: 'record_scores' },
  })

  // Extract the tool_use block
  const toolUseBlock = response.content.find((b) => b.type === 'tool_use')
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') {
    throw new Error('Judge did not call record_scores tool')
  }

  const rawScores = (toolUseBlock.input as { criteria_scores: Array<{ name: string; score: number; reasoning: string }> })
    .criteria_scores

  // Build CriterionScore array, defaulting missing criteria to score 5
  const weightMap = new Map(rubric.criteria.map((c) => [c.name, c.weight]))
  const rawMap = new Map(rawScores.map((s) => [s.name, s]))

  const criteriaScores: CriterionScore[] = rubric.criteria.map((c) => {
    const raw = rawMap.get(c.name)
    if (raw) {
      return { name: c.name, score: Math.min(10, Math.max(1, raw.score)), reasoning: raw.reasoning }
    }
    // Claude omitted this criterion — default to 5
    return { name: c.name, score: 5, reasoning: '(not scored by judge — defaulting to 5)' }
  })

  // Weighted sum → 0–10
  const overallScore = criteriaScores.reduce((sum, cs) => {
    const weight = weightMap.get(cs.name) ?? 0
    return sum + cs.score * weight
  }, 0)

  const roundedScore = Math.round(overallScore * 100) / 100

  const id = crypto.randomUUID()
  const createdAt = new Date()

  // Persist to DB (store overallScore as integer ×100 to avoid float imprecision)
  await db.insert(judgements).values({
    id,
    runId: run.id,
    rubricId: rubric.id,
    // stored as integer 0–1000 (score × 100); divide by 100 on read
    overallScore: Math.round(roundedScore * 100),
    criteriaScores,
    createdAt,
  })

  return {
    id,
    runId: run.id,
    rubricId: rubric.id,
    overallScore: roundedScore,
    criteriaScores,
    createdAt,
  }
}
