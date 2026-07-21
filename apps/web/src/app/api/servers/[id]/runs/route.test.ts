import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      data,
      status: init?.status ?? 200,
    }),
  },
}))

const mockDb = {
  select: vi.fn(),
}

vi.mock('@mcp-test-bench/core', () => ({
  getDbReady: vi.fn(() => mockDb),
  runs: {},
  scenarios: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}))

const { GET } = await import('./route')

const FIXTURE_RUNS = [
  {
    id: 'r1',
    status: 'completed',
    createdAt: new Date('2024-01-01'),
    completedAt: new Date('2024-01-01'),
    scenarioId: 's1',
    tag: 'happy-path',
    scenarioUserPrompt: 'List files',
  },
  {
    id: 'r2',
    status: 'failed',
    createdAt: new Date('2024-01-02'),
    completedAt: null,
    scenarioId: 's2',
    tag: 'edge',
    scenarioUserPrompt: 'Read missing file',
  },
  {
    id: 'r3',
    status: 'completed',
    createdAt: new Date('2024-01-03'),
    completedAt: new Date('2024-01-03'),
    scenarioId: 's3',
    tag: 'edge',
    scenarioUserPrompt: 'Write file',
  },
]

function setupMockDb(rows: typeof FIXTURE_RUNS) {
  mockDb.select.mockReturnValue({
    from: () => ({
      leftJoin: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              all: async () => rows,
            }),
          }),
        }),
      }),
    }),
  })
}

function makeRequest(serverId: string, query = '') {
  return new Request(`http://localhost/api/servers/${serverId}/runs${query ? `?${query}` : ''}`)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/servers/[id]/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all runs when no filters applied', async () => {
    setupMockDb(FIXTURE_RUNS)
    const res = await GET(makeRequest('srv1'), makeParams('srv1'))
    expect(res.status).toBe(200)
    const body = res.data as unknown[]
    expect(body).toHaveLength(3)
  })

  it('filters by status=failed', async () => {
    setupMockDb(FIXTURE_RUNS)
    const res = await GET(makeRequest('srv1', 'status=failed'), makeParams('srv1'))
    const body = res.data as Array<{ status: string }>
    expect(body.every((r) => r.status === 'failed')).toBe(true)
    expect(body).toHaveLength(1)
  })

  it('filters by tag=edge', async () => {
    setupMockDb(FIXTURE_RUNS)
    const res = await GET(makeRequest('srv1', 'tag=edge'), makeParams('srv1'))
    const body = res.data as Array<{ tag: string }>
    expect(body.every((r) => r.tag === 'edge')).toBe(true)
    expect(body).toHaveLength(2)
  })
})
