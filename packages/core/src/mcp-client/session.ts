import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import type { ServerConfig } from './types.js'

export class McpSession {
  private constructor(private readonly client: Client) {}

  static async create(config: ServerConfig): Promise<McpSession> {
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

    await client.connect(transport)
    return new McpSession(client)
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: unknown; isError: boolean }> {
    const result = await this.client.callTool({ name, arguments: args })
    return {
      content: result.content,
      isError: result.isError === true,
    }
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
