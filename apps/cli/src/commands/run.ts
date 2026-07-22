import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { eq } from 'drizzle-orm'
import {
  getDbReady,
  servers,
  scenarios,
  runs,
  turns,
  judgements,
  findings,
  discoverServer,
  generateScenarios,
  runScenario,
  judgeRun,
  scanServer,
  BUILTIN_RUBRICS,
} from '@mcp-test-bench/core'
import type { CliConfig } from '../config.js'
import type { GeneratedScenario } from '@mcp-test-bench/core'

export async function runCommand(
  configPath: string,
  opts: { db: string; baseline?: string; scan: boolean },
  config: CliConfig,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('mcpbench: ANTHROPIC_API_KEY environment variable is not set')
    process.exit(1)
  }

  const db = await getDbReady(opts.db)

  // Upsert server
  const serverConfig =
    config.server.type === 'stdio'
      ? {
          type: 'stdio' as const,
          command: config.server.command,
          args: config.server.args,
          env: config.server.env,
        }
      : { type: 'sse' as const, url: config.server.url }

  let serverId: string
  const existing = await db
    .select()
    .from(servers)
    .where(eq(servers.name, config.server.name))
    .limit(1)

  if (existing.length > 0) {
    serverId = existing[0].id
  } else {
    serverId = crypto.randomUUID()
    await db.insert(servers).values({
      id: serverId,
      name: config.server.name,
      config: serverConfig,
      createdAt: new Date(),
    })
  }

  // Discover
  console.error(`mcpbench: discovering tools for "${config.server.name}"...`)
  let discoveredSchema: Awaited<ReturnType<typeof discoverServer>>
  try {
    discoveredSchema = await discoverServer(serverConfig)
  } catch (err) {
    console.error(`mcpbench: failed to connect to server: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  await db
    .update(servers)
    .set({ discoveredSchema })
    .where(eq(servers.id, serverId))

  console.error(
    `mcpbench: discovered ${discoveredSchema.tools.length} tools, ${discoveredSchema.resources.length} resources, ${discoveredSchema.prompts.length} prompts`,
  )

  // Resolve scenarios
  let generatedScenarios: GeneratedScenario[]
  if ('generate' in config.scenarios) {
    console.error(`mcpbench: generating ${config.scenarios.generate} scenarios...`)
    generatedScenarios = await generateScenarios({
      discoveredSchema,
      serverName: config.server.name,
      anthropicApiKey: apiKey,
      count: config.scenarios.generate,
    })
    console.error(`mcpbench: generated ${generatedScenarios.length} scenarios`)
  } else {
    // Load from file
    const scenarioFile = resolve(config.scenarios.file)
    const raw = yaml.load(readFileSync(scenarioFile, 'utf-8')) as { scenarios?: unknown[] }
    const items = Array.isArray(raw) ? raw : (raw?.scenarios ?? [])
    generatedScenarios = (items as GeneratedScenario[]).filter(
      (s) => s && typeof s.systemPrompt === 'string' && typeof s.userPrompt === 'string',
    )
    console.error(`mcpbench: loaded ${generatedScenarios.length} scenarios from file`)
  }

  if (generatedScenarios.length === 0) {
    console.error('mcpbench: no scenarios to run')
    process.exit(1)
  }

  // Insert scenarios into DB
  const scenarioRows = generatedScenarios.map((s) => ({
    id: crypto.randomUUID(),
    serverId,
    systemPrompt: s.systemPrompt,
    userPrompt: s.userPrompt,
    expectedCriteria: s.expectedCriteria,
    tag: s.tag,
    createdAt: new Date(),
  }))
  await db.insert(scenarios).values(scenarioRows)

  // Security scan (static)
  if (opts.scan !== false) {
    console.error('mcpbench: running security scan...')
    const scanResult = await scanServer({ serverId, discoveredSchema, db })
    for (const f of scanResult.findings) {
      const prefix =
        f.severity === 'critical'
          ? '[CRITICAL]'
          : f.severity === 'warn'
            ? '[WARN]   '
            : '[INFO]   '
      console.error(`  ${prefix} ${f.title} — ${f.detail}`)
    }
    if (scanResult.findings.length === 0) {
      console.error('  [OK]     no security findings')
    }
  }

  // Resolve rubric
  const rubricKey = config.rubric === 'data-retrieval' ? 'data_retrieval' : config.rubric === 'code-execution' ? 'code_execution' : config.rubric
  const rubric = BUILTIN_RUBRICS[rubricKey] ?? BUILTIN_RUBRICS['general']

  // Run each scenario in series
  const results: Array<{ name: string; score: number; status: 'completed' | 'failed' }> = []

  for (let i = 0; i < scenarioRows.length; i++) {
    const scenarioRow = scenarioRows[i]
    const scenario = generatedScenarios[i]
    const runId = crypto.randomUUID()

    console.error(
      `\nmcpbench: [${i + 1}/${scenarioRows.length}] ${scenario.tag} — ${scenario.userPrompt.slice(0, 80)}`,
    )

    // Insert run
    await db.insert(runs).values({
      id: runId,
      scenarioId: scenarioRow.id,
      serverId,
      status: 'pending',
      createdAt: new Date(),
    })

    const runObj = { id: runId, scenarioId: scenarioRow.id, serverId }
    let runStatus: 'completed' | 'failed' = 'completed'

    try {
      for await (const event of runScenario({
        run: runObj,
        scenario: {
          systemPrompt: scenario.systemPrompt,
          userPrompt: scenario.userPrompt,
        },
        serverConfig,
        discoveredSchema,
        db,
        anthropicApiKey: apiKey,
      })) {
        if (event.type === 'tool_call') {
          console.error(`  → tool: ${event.toolName}(${JSON.stringify(event.toolInput).slice(0, 60)})`)
        } else if (event.type === 'tool_result') {
          const preview = JSON.stringify(event.result).slice(0, 60)
          console.error(`  ← ${event.isError ? 'error' : 'result'}: ${preview}`)
        } else if (event.type === 'run_failed') {
          runStatus = 'failed'
          console.error(`  ✗ run failed: ${event.error}`)
        }
      }
    } catch (err) {
      runStatus = 'failed'
      console.error(`  ✗ run error: ${err instanceof Error ? err.message : String(err)}`)
    }

    // Judge the run
    let score = 0
    if (runStatus === 'completed') {
      try {
        const runTurns = await db.select().from(turns).where(eq(turns.runId, runId))
        const judgement = await judgeRun({
          run: { id: runId },
          scenario: {
            systemPrompt: scenario.systemPrompt,
            userPrompt: scenario.userPrompt,
            expectedCriteria: scenario.expectedCriteria,
          },
          turns: runTurns,
          rubric,
          db,
          anthropicApiKey: apiKey,
        })
        score = judgement.overallScore
        console.error(`  score: ${score.toFixed(1)}/10`)
      } catch (err) {
        console.error(`  ✗ judge error: ${err instanceof Error ? err.message : String(err)}`)
        runStatus = 'failed'
      }
    }

    results.push({ name: scenario.userPrompt.slice(0, 60), score, status: runStatus })
  }

  // Summary table
  console.error('\n--- Summary ---')
  for (const r of results) {
    const mark = r.status === 'completed' ? '✓' : '✗'
    console.error(`  ${mark} ${r.name.padEnd(62)} ${r.score.toFixed(1)}/10`)
  }

  const completedResults = results.filter((r) => r.status === 'completed')
  const meanScore =
    completedResults.length > 0
      ? completedResults.reduce((sum, r) => sum + r.score, 0) / completedResults.length
      : 0

  console.error(`\nOverall mean score: ${meanScore.toFixed(2)}/10`)
  console.log(JSON.stringify({ meanScore: parseFloat(meanScore.toFixed(2)), runs: results.length, completed: completedResults.length }))

  // Check baseline and critical findings
  const baselineScore = opts.baseline != null ? parseFloat(opts.baseline) : config.baseline?.score

  // Check critical findings
  const dbFindings = await db
    .select()
    .from(findings)
    .where(eq(findings.serverId, serverId))

  const hasCritical = dbFindings.some((f) => f.severity === 'critical')

  if (hasCritical) {
    console.error('mcpbench: exit 1 — critical security findings detected')
    process.exit(1)
  }

  if (baselineScore != null && meanScore < baselineScore) {
    console.error(`mcpbench: exit 1 — score ${meanScore.toFixed(2)} below baseline ${baselineScore}`)
    process.exit(1)
  }

  process.exit(0)
}
