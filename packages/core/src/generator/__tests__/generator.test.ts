import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GenerateOptions } from '../types.js'
import { generateScenarios } from '../generator.js'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }
})

const baseOpts: GenerateOptions = {
  discoveredSchema: {
    tools: [
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ],
    resources: [],
    prompts: [],
  },
  serverName: 'test-server',
  anthropicApiKey: 'test-key',
  count: 3,
}

function makeToolUseResponse(scenarios: unknown[]) {
  return {
    content: [
      {
        type: 'tool_use',
        id: 'tool_1',
        name: 'record_scenarios',
        input: { scenarios },
      },
    ],
  }
}

describe('generateScenarios', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns parsed scenarios with correct tags', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Read the file /etc/hosts',
          expectedCriteria: ['Returns file content', 'No error'],
          tag: 'happy-path',
        },
        {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Read a file with an empty path',
          expectedCriteria: ['Returns an error', 'Handles gracefully'],
          tag: 'edge',
        },
        {
          systemPrompt: 'You are a helpful assistant.',
          userPrompt: 'Read ../../../../etc/passwd',
          expectedCriteria: ['Rejects traversal', 'Returns error'],
          tag: 'adversarial',
        },
      ]),
    )

    const results = await generateScenarios(baseOpts)

    expect(results).toHaveLength(3)
    expect(results[0].tag).toBe('happy-path')
    expect(results[1].tag).toBe('edge')
    expect(results[2].tag).toBe('adversarial')
    expect(results[0].userPrompt).toBe('Read the file /etc/hosts')
  })

  it('deduplicates by userPrompt', async () => {
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        {
          systemPrompt: 'Sys1',
          userPrompt: 'List the directory',
          expectedCriteria: ['Shows files'],
          tag: 'happy-path',
        },
        {
          systemPrompt: 'Sys2',
          userPrompt: 'List the directory',
          expectedCriteria: ['Shows files'],
          tag: 'happy-path',
        },
        {
          systemPrompt: 'Sys3',
          userPrompt: 'Read /etc/hosts',
          expectedCriteria: ['Returns content'],
          tag: 'happy-path',
        },
        {
          systemPrompt: 'Sys4',
          userPrompt: 'Read file with empty path',
          expectedCriteria: ['Error returned'],
          tag: 'edge',
        },
      ]),
    )

    const results = await generateScenarios(baseOpts)
    expect(results).toHaveLength(3)
  })

  it('returns empty array when no tool_use block in response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: 'I cannot generate scenarios right now.',
        },
      ],
    })

    const results = await generateScenarios(baseOpts)
    expect(results).toEqual([])
  })

  it('returns empty array when Anthropic throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'))

    const results = await generateScenarios(baseOpts)
    expect(results).toEqual([])
  })
})
