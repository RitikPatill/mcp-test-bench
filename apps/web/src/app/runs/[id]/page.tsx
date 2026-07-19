import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { getDbReady, runs, turns, servers, scenarios } from '@mcp-test-bench/core'
import { RunTrace } from '@/components/run-trace'

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: runId } = await params
  const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

  const run = await db.select().from(runs).where(eq(runs.id, runId)).get()
  if (!run) notFound()

  const scenario = await db
    .select()
    .from(scenarios)
    .where(eq(scenarios.id, run.scenarioId))
    .get()

  const server = await db
    .select()
    .from(servers)
    .where(eq(servers.id, run.serverId))
    .get()

  const runTurns = await db
    .select()
    .from(turns)
    .where(eq(turns.runId, runId))
    .orderBy(turns.index)
    .all()

  const initialTurns = runTurns.map((t) => ({
    index: t.index,
    toolCalls: (t.toolCalls ?? []).map((tc) => ({
      toolUseId: tc.id,
      toolName: tc.name,
      toolInput: tc.input,
    })),
    toolResults: (t.toolResults ?? []).map((tr) => ({
      toolUseId: tr.id,
      toolName: '',
      result: tr.content,
      isError: tr.isError,
    })),
  }))

  const statusColor =
    run.status === 'completed'
      ? 'bg-green-100 text-green-800'
      : run.status === 'failed'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800'

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Run detail</h1>
        <p className="font-mono text-sm text-gray-500">{runId}</p>
      </div>

      <div className="rounded border bg-white p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusColor}`}>
            {run.status}
          </span>
        </div>
        {server && (
          <div className="text-sm">
            <span className="font-medium text-gray-600">Server: </span>
            {server.name}
          </div>
        )}
        {scenario && (
          <>
            <div className="text-sm">
              <span className="font-medium text-gray-600">System prompt: </span>
              {scenario.systemPrompt}
            </div>
            <div className="text-sm">
              <span className="font-medium text-gray-600">User prompt: </span>
              {scenario.userPrompt}
            </div>
          </>
        )}
      </div>

      <RunTrace runId={runId} initialTurns={initialTurns} initialStatus={run.status} />
    </main>
  )
}
