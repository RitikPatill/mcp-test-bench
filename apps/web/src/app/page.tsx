import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { getDbReady, servers, scenarios } from '@mcp-test-bench/core'
import { Badge } from '@/components/ui/badge'
import { ServerAddForm } from '@/components/server-add-form'

export default async function Home() {
  const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')
  const serverRows = await db.select().from(servers).all()

  // Count scenarios per server
  const scenarioCounts: Record<string, number> = {}
  for (const s of serverRows) {
    const rows = await db.select().from(scenarios).where(eq(scenarios.serverId, s.id)).all()
    scenarioCounts[s.id] = rows.length
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-8">
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
      {serverRows.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Servers</h2>
          <div className="rounded border bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Tools</th>
                  <th className="px-4 py-3">Scenarios</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {serverRows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/servers/${s.id}`} className="hover:underline text-blue-700">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{s.config.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.discoveredSchema?.tools.length ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{scenarioCounts[s.id] ?? 0}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {s.createdAt instanceof Date
                        ? s.createdAt.toLocaleDateString()
                        : new Date(s.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}
