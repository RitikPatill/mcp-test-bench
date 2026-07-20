import { eq } from 'drizzle-orm'
import { findings } from '../db/index.js'
import {
  checkPromptInjection,
  checkUnboundedOutput,
  checkDestructiveTools,
  runtimeScanOutputs,
} from './checks.js'
import type { ScanOptions, ScanResult, Finding } from './types.js'

export async function scanServer(opts: ScanOptions): Promise<ScanResult> {
  const { serverId, discoveredSchema, turns, db } = opts

  // Run all static checks
  const rawFindings = [
    ...checkPromptInjection(discoveredSchema, serverId),
    ...checkUnboundedOutput(discoveredSchema, serverId),
    ...checkDestructiveTools(discoveredSchema, serverId),
    ...(turns ? runtimeScanOutputs(turns, serverId) : []),
  ]

  const scannedAt = new Date()

  // Assign IDs and timestamps
  const fullFindings: Finding[] = rawFindings.map((f) => ({
    ...f,
    id: crypto.randomUUID(),
    createdAt: scannedAt,
  }))

  // Idempotent: delete existing findings for this server before inserting
  await db.delete(findings).where(eq(findings.serverId, serverId))

  // Bulk-insert new findings
  if (fullFindings.length > 0) {
    await db.insert(findings).values(
      fullFindings.map((f) => ({
        id: f.id,
        serverId: f.serverId,
        category: f.category,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        remediation: f.remediation,
        location: f.location,
        createdAt: f.createdAt,
      })),
    )
  }

  return { findings: fullFindings, scannedAt }
}
