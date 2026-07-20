import { notFound } from 'next/navigation'
import Link from 'next/link'
import { eq, and, desc } from 'drizzle-orm'
import { getDbReady, servers, scenarios } from '@mcp-test-bench/core'
import type { ScenarioTag } from '@mcp-test-bench/core'
import { Badge } from '@/components/ui/badge'
import { ScenarioGenerator } from '@/components/scenario-generator'
import { RunButton } from './run-button'

const TAG_LABELS: Record<ScenarioTag | 'all', string> = {
  all: 'All',
  'happy-path': 'Happy path',
  edge: 'Edge',
  adversarial: 'Adversarial',
}

const TAG_COLORS: Record<ScenarioTag, string> = {
  'happy-path': 'bg-green-100 text-green-800',
  edge: 'bg-yellow-100 text-yellow-800',
  adversarial: 'bg-red-100 text-red-800',
}

export default async function ServerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tag?: string }>
}) {
  const { id } = await params
  const { tag: tagParam } = await searchParams

  const db = await getDbReady(process.env.DATABASE_PATH ?? 'local.db')

  const server = await db.select().from(servers).where(eq(servers.id, id)).get()
  if (!server) notFound()

  const validTags = new Set<string>(['happy-path', 'edge', 'adversarial'])
  const activeTag = tagParam && validTags.has(tagParam) ? (tagParam as ScenarioTag) : null

  const whereClause = activeTag
    ? and(eq(scenarios.serverId, id), eq(scenarios.tag, activeTag))
    : eq(scenarios.serverId, id)

  const scenarioRows = await db
    .select()
    .from(scenarios)
    .where(whereClause)
    .orderBy(desc(scenarios.createdAt))
    .all()

  const schema = server.discoveredSchema
  const toolCount = schema?.tools.length ?? 0
  const resourceCount = schema?.resources.length ?? 0
  const promptCount = schema?.prompts.length ?? 0

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{server.name}</h1>
          <Badge variant="secondary">{server.config.type}</Badge>
        </div>
        <p className="font-mono text-xs text-gray-500">
          {'command' in server.config ? server.config.command : server.config.url}
        </p>
        <div className="flex gap-4 text-sm text-gray-500 pt-1">
          <span>{toolCount} tools</span>
          <span>{resourceCount} resources</span>
          <span>{promptCount} prompts</span>
        </div>
      </div>

      {/* Schema accordion */}
      {schema && schema.tools.length > 0 && (
        <section className="rounded border bg-white shadow-sm">
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold select-none">
              Tools ({toolCount})
            </summary>
            <ul className="divide-y border-t">
              {schema.tools.map((tool) => (
                <li key={tool.name} className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer font-mono text-sm font-medium select-none">
                      {tool.name}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {tool.description && (
                        <p className="text-sm text-gray-600">{tool.description}</p>
                      )}
                      <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                        {JSON.stringify(tool.inputSchema, null, 2)}
                      </pre>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* Scenario generator */}
      <ScenarioGenerator serverId={id} />

      {/* Tag filter bar */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'happy-path', 'edge', 'adversarial'] as const).map((t) => {
          const isActive = t === 'all' ? !activeTag : activeTag === t
          const href = t === 'all' ? `/servers/${id}` : `/servers/${id}?tag=${t}`
          return (
            <Link key={t} href={href}>
              <Badge variant={isActive ? 'default' : 'secondary'}>{TAG_LABELS[t]}</Badge>
            </Link>
          )
        })}
      </div>

      {/* Scenario cards */}
      {scenarioRows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No scenarios yet. Click &ldquo;Generate scenarios&rdquo; to create some.
        </p>
      ) : (
        <ul className="space-y-3">
          {scenarioRows.map((s) => (
            <li key={s.id} className="rounded border bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${TAG_COLORS[s.tag as ScenarioTag] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {s.tag}
                </span>
              </div>
              <p className="text-xs text-gray-500 italic truncate">{s.systemPrompt}</p>
              <p className="text-sm font-medium">{s.userPrompt}</p>
              {s.expectedCriteria && (s.expectedCriteria as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(s.expectedCriteria as string[]).map((c, i) => (
                    <span
                      key={i}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              <RunButton scenarioId={s.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
