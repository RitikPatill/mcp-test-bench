import { describe, it, expect, vi, beforeEach } from 'vitest'
import { judgeRun, formatTranscript } from './judge.js'
import { GENERAL_RUBRIC } from './rubrics.js'
import type { JudgeOptions } from './types.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
    __mockCreate: mockCreate,
  }
})

// In-memory DB stub
function makeDb(insertedRows: unknown[]) {
  return {
    insert: () => ({
      values: (row: unknown) => {
        insertedRows.push(row)
        return Promise.resolve()
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => Promise.resolve(null),
          all: () => Promise.resolve([]),
        }),
      }),
    }),
  }
}

// ---------------------------------------------------------------------------
// formatTranscript tests
// ---------------------------------------------------------------------------

describe('formatTranscript', () => {
  it('returns placeholder for empty turns', () => {
    expect(formatTranscript([])).toBe('(no turns recorded)')
  })

  it('includes turn indices and tool names', () => {
    const turns: JudgeOptions['turns'] = [
      {
        index: 0,
        assistantMessage: [{ type: 'text', text: 'Let me read the file.' }],
        toolCalls: [{ id: 'tc1', name: 'read_file', input: { path: '/tmp/test.txt' } }],
        toolResults: [{ id: 'tc1', content: 'hello world', isError: false }],
      },
      {
        index: 1,
        assistantMessage: [{ type: 'text', text: 'Done.' }],
        toolCalls: [{ id: 'tc2', name: 'list_directory', input: { path: '/tmp' } }],
        toolResults: [{ id: 'tc2', content: ['test.txt'], isError: false }],
      },
    ]

    const transcript = formatTranscript(turns)

    expect(transcript).toContain('TURN 0:')
    expect(transcript).toContain('TURN 1:')
    expect(transcript).toContain('read_file')
    expect(transcript).toContain('list_directory')
    expect(transcript).toContain('Let me read the file.')
    expect(transcript).toContain('Done.')
  })

  it('marks error tool results distinctly', () => {
    const turns: JudgeOptions['turns'] = [
      {
        index: 0,
        assistantMessage: [],
        toolCalls: [{ id: 'tc1', name: 'read_file', input: {} }],
        toolResults: [{ id: 'tc1', content: 'Permission denied', isError: true }],
      },
    ]
    const transcript = formatTranscript(turns)
    expect(transcript).toContain('Tool error')
  })
})

// ---------------------------------------------------------------------------
// judgeRun happy path
// ---------------------------------------------------------------------------

describe('judgeRun', () => {
  let insertedRows: unknown[]

  beforeEach(async () => {
    insertedRows = []
    const { __mockCreate } = await import('@anthropic-ai/sdk') as unknown as {
      __mockCreate: ReturnType<typeof vi.fn>
    }
    __mockCreate.mockReset()
    __mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'record_scores',
          input: {
            criteria_scores: [
              { name: 'correctness', score: 9, reasoning: 'Task completed correctly.' },
              { name: 'tool_selection', score: 8, reasoning: 'Good tool choices.' },
              { name: 'efficiency', score: 7, reasoning: 'One extra step.' },
              { name: 'safety', score: 10, reasoning: 'No unsafe actions.' },
            ],
          },
        },
      ],
    })
  })

  it('inserts a judgement row and returns correct overall score', async () => {
    const db = makeDb(insertedRows)

    const opts: JudgeOptions = {
      run: { id: 'run-1' },
      scenario: {
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: 'List files in /tmp',
        expectedCriteria: ['list files'],
      },
      turns: [
        {
          index: 0,
          assistantMessage: [{ type: 'text', text: 'Listing files.' }],
          toolCalls: [{ id: 'tc1', name: 'list_directory', input: { path: '/tmp' } }],
          toolResults: [{ id: 'tc1', content: ['a.txt'], isError: false }],
        },
      ],
      rubric: GENERAL_RUBRIC,
      db: db as unknown as JudgeOptions['db'],
      anthropicApiKey: 'test-key',
    }

    const judgement = await judgeRun(opts)

    expect(judgement.runId).toBe('run-1')
    expect(judgement.rubricId).toBe('general')
    expect(judgement.criteriaScores).toHaveLength(4)

    // weighted sum: 9*0.4 + 8*0.25 + 7*0.2 + 10*0.15 = 3.6+2+1.4+1.5 = 8.5
    expect(judgement.overallScore).toBeCloseTo(8.5, 1)

    expect(insertedRows).toHaveLength(1)
    const row = insertedRows[0] as Record<string, unknown>
    expect(row.runId).toBe('run-1')
    expect(row.overallScore).toBe(850) // stored ×100
  })

  it('handles missing criteria from Claude by defaulting to score 5', async () => {
    const { __mockCreate } = await import('@anthropic-ai/sdk') as unknown as {
      __mockCreate: ReturnType<typeof vi.fn>
    }
    // Claude only returns 2 of the 4 criteria
    __mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tu1',
          name: 'record_scores',
          input: {
            criteria_scores: [
              { name: 'correctness', score: 8, reasoning: 'Good.' },
              { name: 'safety', score: 9, reasoning: 'Safe.' },
            ],
          },
        },
      ],
    })

    const db = makeDb(insertedRows)
    const opts: JudgeOptions = {
      run: { id: 'run-2' },
      scenario: { systemPrompt: 'sys', userPrompt: 'user', expectedCriteria: [] },
      turns: [],
      rubric: GENERAL_RUBRIC,
      db: db as unknown as JudgeOptions['db'],
      anthropicApiKey: 'test-key',
    }

    const judgement = await judgeRun(opts)

    // Should not throw; should have 4 criteria (2 real + 2 defaulted to 5)
    expect(judgement.criteriaScores).toHaveLength(4)

    const missing = judgement.criteriaScores.filter((cs) => cs.score === 5)
    expect(missing).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Weighted score math
// ---------------------------------------------------------------------------

describe('weighted score formula', () => {
  it('computes correct weighted sum for known inputs', () => {
    const criteria = [
      { name: 'a', weight: 0.5, score: 8 },
      { name: 'b', weight: 0.3, score: 6 },
      { name: 'c', weight: 0.2, score: 10 },
    ]
    const overall = criteria.reduce((sum, c) => sum + c.score * c.weight, 0)
    // 8*0.5 + 6*0.3 + 10*0.2 = 4 + 1.8 + 2 = 7.8
    expect(overall).toBeCloseTo(7.8, 5)
  })
})
