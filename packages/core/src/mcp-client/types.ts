export type ServerConfig =
  | { type: 'stdio'; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'sse'; url: string }

export interface ToolSchema {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface ResourceSchema {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export interface PromptSchema {
  name: string
  description?: string
  arguments?: Array<{ name: string; description?: string; required?: boolean }>
}

export interface DiscoveredSchema {
  tools: ToolSchema[]
  resources: ResourceSchema[]
  prompts: PromptSchema[]
}
