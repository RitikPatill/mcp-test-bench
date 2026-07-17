import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { ServerConfig, DiscoveredSchema, ToolSchema, ResourceSchema, PromptSchema } from './types.js'

export async function discoverServer(config: ServerConfig): Promise<DiscoveredSchema> {
  const transport =
    config.type === 'stdio'
      ? new StdioClientTransport({
          command: config.command,
          args: config.args ?? [],
          env: config.env,
        })
      : new SSEClientTransport(new URL(config.url))

  const client = new Client(
    { name: 'mcp-test-bench', version: '0.0.1' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  )

  try {
    await client.connect(transport)

    const tools: ToolSchema[] = await client
      .listTools()
      .then((r) =>
        r.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as Record<string, unknown>,
        })),
      )
      .catch(() => [])

    const resources: ResourceSchema[] = await client
      .listResources()
      .then((r) =>
        r.resources.map((res) => ({
          uri: res.uri,
          name: res.name,
          description: res.description,
          mimeType: res.mimeType,
        })),
      )
      .catch(() => [])

    const prompts: PromptSchema[] = await client
      .listPrompts()
      .then((r) =>
        r.prompts.map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments?.map((a) => ({
            name: a.name,
            description: a.description,
            required: a.required,
          })),
        })),
      )
      .catch(() => [])

    return { tools, resources, prompts }
  } finally {
    await client.close()
  }
}
