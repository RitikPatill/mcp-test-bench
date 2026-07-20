import type { DiscoveredSchema } from '../mcp-client/types.js'
import type { DrizzleDb } from '../db/index.js'

export type Severity = 'info' | 'warn' | 'critical'
export type FindingCategory =
  | 'prompt-injection'
  | 'unbounded-output'
  | 'destructive-tool'
  | 'pii-risk'
  | 'suspicious-output'

export interface Finding {
  id: string
  serverId: string
  category: FindingCategory
  severity: Severity
  title: string
  detail: string
  remediation: string
  location: string
  createdAt: Date
}

export interface ScanOptions {
  serverId: string
  discoveredSchema: DiscoveredSchema
  turns?: Array<{
    index: number
    toolCalls: Array<{ id: string; name: string; input: unknown }>
    toolResults: Array<{ id: string; content: unknown; isError: boolean }>
  }>
  db: DrizzleDb
}

export interface ScanResult {
  findings: Finding[]
  scannedAt: Date
}
