import { eq } from 'drizzle-orm'
import { getDbReady, servers, scenarios } from '@mcp-test-bench/core'
import { Badge } from '@/components/ui/badge'
import { ServerAddForm } from '@/components/server-add-form'
import { ServerTable } from '@/components/server-table'

export default async function Home() {
  const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')
  const serverRows = await db.select().from(servers).all()

  // Count scenarios per server
  const scenarioCounts: Record<string, number> = {}
  for (const s of serverRows) {
    const rows = await db.select().from(scenarios).where(eq(scenarios.serverId, s.id)).all()
    scenarioCounts[s.id] = rows.length
  }

  // Fetch stats for each server
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const statsMap: Record<string, {
    latestScore: number | null
    sparkline: { score: number; date: string }[]
    totalRuns: number
    passRate: number
    findingCounts: { critical: number; warn: number; info: number }
  } | null> = {}

  await Promise.all(
    serverRows.map(async (s) => {
      try {
        const res = await fetch(`${baseUrl}/api/servers/${s.id}/stats`, { cache: 'no-store' })
        statsMap[s.id] = res.ok ? await res.json() : null
      } catch {
        statsMap[s.id] = null
      }
    }),
  )

  const tableServers = serverRows.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.config.type,
    toolCount: s.discoveredSchema?.tools.length ?? '—',
    scenarioCount: scenarioCounts[s.id] ?? 0,
    createdAt:
      s.createdAt instanceof Date
        ? s.createdAt.toLocaleDateString()
        : new Date(s.createdAt).toLocaleDateString(),
    stats: statsMap[s.id] ?? null,
  }))

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-8">
      {/* Hero */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">MCP Test Bench</h1>
          <Badge variant="secondary">v0.1.0-alpha</Badge>
        </div>
        <p className="text-muted-foreground max-w-lg">
          Evaluation harness for Model Context Protocol servers. Discover tools, generate test
          scenarios with Claude, score with LLM-as-judge, and audit for security issues.
        </p>
      </div>

      {/* Add server */}
      <ServerAddForm />

      {/* Server list */}
      {serverRows.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Servers</h2>
          <ServerTable servers={tableServers} />
        </section>
      ) : (
        <section className="rounded border border-dashed p-12 text-center">
          <p className="text-muted-foreground text-sm">
            No servers yet. Add your first MCP server above.
          </p>
        </section>
      )}
    </main>
  )
}
