import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CliConfigSchema, loadConfig } from '../config.js'
import { ZodError } from 'zod'

function writeTempYaml(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mcpbench-test-'))
  const filePath = join(dir, 'config.yaml')
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('CliConfigSchema', () => {
  it('parses a valid stdio config', () => {
    const result = CliConfigSchema.parse({
      server: {
        type: 'stdio',
        name: 'my-server',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
      },
      rubric: 'general',
      scenarios: { generate: 10 },
      baseline: { score: 7.0 },
    })
    expect(result.server.type).toBe('stdio')
    expect(result.server.name).toBe('my-server')
    if (result.server.type === 'stdio') {
      expect(result.server.command).toBe('npx')
    }
    expect(result.rubric).toBe('general')
    expect(result.baseline?.score).toBe(7.0)
  })

  it('parses a valid SSE config', () => {
    const result = CliConfigSchema.parse({
      server: {
        type: 'sse',
        name: 'remote-server',
        url: 'http://localhost:3001/sse',
      },
    })
    expect(result.server.type).toBe('sse')
    if (result.server.type === 'sse') {
      expect(result.server.url).toBe('http://localhost:3001/sse')
    }
    // defaults
    expect(result.rubric).toBe('general')
    expect(result.scenarios).toEqual({ generate: 10 })
  })

  it('throws ZodError for missing server.name', () => {
    expect(() =>
      CliConfigSchema.parse({
        server: { type: 'stdio', command: 'npx' },
      }),
    ).toThrow(ZodError)
  })

  it('throws ZodError for invalid rubric name', () => {
    expect(() =>
      CliConfigSchema.parse({
        server: { type: 'stdio', name: 's', command: 'cmd' },
        rubric: 'not-a-real-rubric',
      }),
    ).toThrow(ZodError)
  })

  it('throws ZodError when scenarios.generate is out of range', () => {
    expect(() =>
      CliConfigSchema.parse({
        server: { type: 'stdio', name: 's', command: 'cmd' },
        scenarios: { generate: 0 },
      }),
    ).toThrow(ZodError)

    expect(() =>
      CliConfigSchema.parse({
        server: { type: 'stdio', name: 's', command: 'cmd' },
        scenarios: { generate: 51 },
      }),
    ).toThrow(ZodError)
  })

  it('throws ZodError when baseline.score > 10', () => {
    expect(() =>
      CliConfigSchema.parse({
        server: { type: 'stdio', name: 's', command: 'cmd' },
        baseline: { score: 11 },
      }),
    ).toThrow(ZodError)
  })
})

describe('loadConfig', () => {
  it('loads and parses a valid YAML file', () => {
    const yaml = `
server:
  type: stdio
  name: test-server
  command: node
  args: ["server.js"]
rubric: filesystem
scenarios:
  generate: 5
baseline:
  score: 6.5
`
    const filePath = writeTempYaml(yaml)
    try {
      const config = loadConfig(filePath)
      expect(config.server.name).toBe('test-server')
      expect(config.rubric).toBe('filesystem')
      expect(config.baseline?.score).toBe(6.5)
    } finally {
      rmSync(filePath)
    }
  })

  it('throws for an invalid YAML config file', () => {
    const yaml = `
server:
  type: stdio
  command: npx
rubric: invalid-rubric
`
    const filePath = writeTempYaml(yaml)
    try {
      expect(() => loadConfig(filePath)).toThrow()
    } finally {
      rmSync(filePath)
    }
  })
})
