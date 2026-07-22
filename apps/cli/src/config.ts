import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { z } from 'zod'

const StdioServerSchema = z.object({
  type: z.literal('stdio'),
  name: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

const SseServerSchema = z.object({
  type: z.literal('sse'),
  name: z.string().min(1),
  url: z.string().url(),
})

export const CliConfigSchema = z.object({
  server: z.discriminatedUnion('type', [StdioServerSchema, SseServerSchema]),
  rubric: z
    .enum(['general', 'filesystem', 'data-retrieval', 'code-execution'])
    .default('general'),
  scenarios: z
    .union([
      z.object({ generate: z.number().int().min(1).max(50) }),
      z.object({ file: z.string().min(1) }),
    ])
    .default({ generate: 10 }),
  baseline: z
    .object({ score: z.number().min(0).max(10) })
    .optional(),
})

export type CliConfig = z.infer<typeof CliConfigSchema>

export function loadConfig(filePath: string): CliConfig {
  const absPath = resolve(filePath)
  const raw = readFileSync(absPath, 'utf-8')
  const parsed = yaml.load(raw)
  return CliConfigSchema.parse(parsed)
}
