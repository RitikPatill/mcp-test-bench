import type { DiscoveredSchema } from '../mcp-client/types.js'

export type ScenarioTag = 'happy-path' | 'edge' | 'adversarial'

export interface GeneratedScenario {
  systemPrompt: string
  userPrompt: string
  expectedCriteria: string[]
  tag: ScenarioTag
}

export interface GenerateOptions {
  discoveredSchema: DiscoveredSchema
  serverName: string
  anthropicApiKey: string
  count?: number
}
