import { writeFileSync } from 'node:fs'
import { desc, eq } from 'drizzle-orm'
import { getDbReady, runs, judgements, turns, findings } from '@mcp-test-bench/core'
import { toJunitXml } from '../junit.js'
import type { JunitCase } from '../junit.js'

interface ReportRun {
  id: string
  scenarioId: string
  serverId: string
  status: string
  createdAt: Date | null
  completedAt: Date | null
}

interface JsonReport {
  runId: string
  serverId: string
  status: string
  createdAt: string | null
  completedAt: string | null
  overallScore: number | null
  rubricId: string | null
  criteriaScores: unknown
  turnCount: number
  findings: unknown[]
}

export async function reportCommand(opts: {
  format: string
  runId?: string
  db: string
  output?: string
}): Promise<void> {
  const db = await getDbReady(opts.db)

  // Resolve which run to report on
  let run: ReportRun | undefined

  if (opts.runId && opts.runId !== 'latest') {
    const rows = await db.select().from(runs).where(eq(runs.id, opts.runId)).limit(1)
    run = rows[0] as ReportRun | undefined
  } else {
    const rows = await db.select().from(runs).orderBy(desc(runs.createdAt)).limit(1)
    run = rows[0] as ReportRun | undefined
  }

  if (!run) {
    console.error('mcpbench report: no runs found in database')
    process.exit(1)
  }

  // Load associated data
  const runJudgements = await db
    .select()
    .from(judgements)
    .where(eq(judgements.runId, run.id))

  const runTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.runId, run.id))

  const serverFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.serverId, run.serverId))

  const primaryJudgement = runJudgements[0]

  const report: JsonReport = {
    runId: run.id,
    serverId: run.serverId,
    status: run.status,
    createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
    completedAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
    overallScore: primaryJudgement ? primaryJudgement.overallScore / 100 : null,
    rubricId: primaryJudgement?.rubricId ?? null,
    criteriaScores: primaryJudgement?.criteriaScores ?? null,
    turnCount: runTurns.length,
    findings: serverFindings,
  }

  let output: string

  if (opts.format === 'junit') {
    const baseline = report.overallScore ?? 0
    const passed = run.status === 'completed' && baseline >= 0
    const junitCase: JunitCase = {
      name: `run:${run.id.slice(0, 8)}`,
      classname: `mcpbench.${run.serverId.slice(0, 8)}`,
      score: report.overallScore ?? 0,
      passed,
      failureMessage: passed
        ? undefined
        : `Run ${run.id} status=${run.status}`,
    }
    output = toJunitXml({
      suiteName: `mcpbench:${run.serverId.slice(0, 8)}`,
      cases: [junitCase],
    })
  } else {
    output = JSON.stringify(report, null, 2)
  }

  if (opts.output) {
    writeFileSync(opts.output, output, 'utf-8')
    console.error(`mcpbench report: written to ${opts.output}`)
  } else {
    process.stdout.write(output + '\n')
  }
}
