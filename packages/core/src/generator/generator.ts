import Anthropic from '@anthropic-ai/sdk'
import type { GenerateOptions, GeneratedScenario, ScenarioTag } from './types.js'

const MAX_SCHEMA_CHARS = 3000

function serializeSchema(opts: GenerateOptions): string {
  const tools = opts.discoveredSchema.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }))
  const json = JSON.stringify(tools, null, 2)
  if (json.length <= MAX_SCHEMA_CHARS) return json
  return json.slice(0, MAX_SCHEMA_CHARS) + '\n...truncated'
}

export async function generateScenarios(opts: GenerateOptions): Promise<GeneratedScenario[]> {
  const count = opts.count ?? 20
  const anthropic = new Anthropic({ apiKey: opts.anthropicApiKey })

  const schemaStr = serializeSchema(opts)

  const userMessage = `You are a test engineer evaluating an MCP server called "${opts.serverName}".

Here are the tools this server exposes (JSON):
${schemaStr}

Generate exactly ${count} realistic test scenarios for this server distributed roughly:
- 40% happy-path (normal, expected usage)
- 40% edge (boundary conditions, unusual inputs, missing optional params)
- 20% adversarial (prompt injection attempts, unexpected/malicious inputs, resource exhaustion)

Each scenario must have:
- systemPrompt: instruction context for the Claude agent (e.g. "You are a helpful assistant with access to a filesystem MCP server.")
- userPrompt: the actual user request the agent must handle
- expectedCriteria: 2-4 strings describing what a correct response should do/contain
- tag: one of "happy-path", "edge", or "adversarial"

Call the record_scenarios tool with all ${count} scenarios.`

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [
        {
          name: 'record_scenarios',
          description: 'Record the generated test scenarios',
          input_schema: {
            type: 'object' as const,
            properties: {
              scenarios: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    systemPrompt: { type: 'string' },
                    userPrompt: { type: 'string' },
                    expectedCriteria: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    tag: {
                      type: 'string',
                      enum: ['happy-path', 'edge', 'adversarial'],
                    },
                  },
                  required: ['systemPrompt', 'userPrompt', 'expectedCriteria', 'tag'],
                },
              },
            },
            required: ['scenarios'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'record_scenarios' },
      messages: [{ role: 'user', content: userMessage }],
    })
  } catch {
    return []
  }

  const toolUseBlock = response.content.find((b) => b.type === 'tool_use')
  if (!toolUseBlock || toolUseBlock.type !== 'tool_use') return []

  const input = toolUseBlock.input as { scenarios?: unknown[] }
  if (!Array.isArray(input.scenarios)) return []

  const raw = input.scenarios as Array<{
    systemPrompt?: unknown
    userPrompt?: unknown
    expectedCriteria?: unknown
    tag?: unknown
  }>

  const validTags = new Set<ScenarioTag>(['happy-path', 'edge', 'adversarial'])
  const seen = new Set<string>()
  const results: GeneratedScenario[] = []

  for (const item of raw) {
    if (
      typeof item.systemPrompt !== 'string' ||
      typeof item.userPrompt !== 'string' ||
      !Array.isArray(item.expectedCriteria) ||
      !validTags.has(item.tag as ScenarioTag)
    ) {
      continue
    }

    const key = item.userPrompt.toLowerCase().trim()
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      systemPrompt: item.systemPrompt,
      userPrompt: item.userPrompt,
      expectedCriteria: (item.expectedCriteria as unknown[]).filter(
        (c): c is string => typeof c === 'string',
      ),
      tag: item.tag as ScenarioTag,
    })
  }

  return results
}
