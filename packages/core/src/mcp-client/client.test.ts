import { describe, it, expect } from 'vitest'
import { discoverServer } from './client.js'

describe('discoverServer – stdio', () => {
  it('returns tools from server-everything', async () => {
    const schema = await discoverServer({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    })
    expect(schema.tools.length).toBeGreaterThan(0)
    expect(schema.tools[0]).toMatchObject({
      name: expect.any(String),
      inputSchema: expect.any(Object),
    })
  }, 30_000)

  it('tool names are non-empty strings', async () => {
    const schema = await discoverServer({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    })
    for (const tool of schema.tools) {
      expect(tool.name).toBeTruthy()
      expect(typeof tool.name).toBe('string')
    }
  }, 30_000)

  it('returns empty array for resources when none available', async () => {
    const schema = await discoverServer({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything'],
    })
    expect(Array.isArray(schema.resources)).toBe(true)
  }, 30_000)
})
