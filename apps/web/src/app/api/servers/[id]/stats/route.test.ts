import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/server
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      data,
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

// Build a simple chainable DB mock
function makeQueryChain(result: unknown[] | unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'from', 'leftJoin', 'where', 'orderBy', 'limit']
  for (const m of methods) {
    chain[m] = () => chain
  }
  chain['all'] = async () => (Array.isArray(result) ? result : [result])
  chain['get'] = async () => (Array.isArray(result) ? result[0] : result)
  return chain
}

const mockDb = {
  select: vi.fn(),
}

vi.mock('@mcp-test-bench/core', () => ({
  getDbReady: vi.fn(() => mockDb),
  runs: {},
  judgements: {},
  findings: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}))

// Import after mocks
const { GET } = await import('./route')

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest() {
  return new Request('http://localhost/api/servers/s1/stats')
}

describe('GET /api/servers/[id]/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns nulls and zeros when server has no runs', async () => {
    // All queries return empty arrays
    mockDb.select.mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                all: async () => [],
                get: async () => undefined,
              }),
            }),
          }),
        }),
        where: () => ({
          all: async () => [],
        }),
      }),
    })

    const res = await GET(makeRequest(), makeParams('s1'))
    expect(res.status).toBe(200)
    const body = res.data as Record<string, unknown>
    expect(body.latestScore).toBeNull()
    expect(body.sparkline).toEqual([])
    expect(body.totalRuns).toBe(0)
    expect(body.passRate).toBe(0)
    expect(body.findingCounts).toEqual({ critical: 0, warn: 0, info: 0 })
  })

  it('returns correct latestScore (divided by 100) and passRate for completed runs', async () => {
    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Latest judgement query
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    all: async () => [{ overallScore: 820, createdAt: new Date('2024-01-01') }],
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (callCount === 2) {
        // Sparkline query
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    all: async () => [
                      { overallScore: 700, createdAt: new Date('2023-12-01') },
                      { overallScore: 820, createdAt: new Date('2024-01-01') },
                    ],
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (callCount === 3) {
        // Run counts query
        return {
          from: () => ({
            where: () => ({
              all: async () => [
                { status: 'completed' },
                { status: 'completed' },
                { status: 'completed' },
              ],
            }),
          }),
        }
      }
      // Finding counts query
      return {
        from: () => ({
          where: () => ({
            all: async () => [],
          }),
        }),
      }
    })

    const res = await GET(makeRequest(), makeParams('s1'))
    expect(res.status).toBe(200)
    const body = res.data as Record<string, unknown>
    expect(body.latestScore).toBe(8.2)
    expect((body.sparkline as unknown[]).length).toBe(2)
    expect(body.totalRuns).toBe(3)
    expect(body.passRate).toBe(1)
  })

  it('calculates passRate from mixed statuses (only completed counts)', async () => {
    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1 || callCount === 2) {
        // Latest judgement and sparkline — empty
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    all: async () => [],
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (callCount === 3) {
        return {
          from: () => ({
            where: () => ({
              all: async () => [
                { status: 'completed' },
                { status: 'failed' },
                { status: 'running' },
                { status: 'failed' },
              ],
            }),
          }),
        }
      }
      return {
        from: () => ({
          where: () => ({
            all: async () => [],
          }),
        }),
      }
    })

    const res = await GET(makeRequest(), makeParams('s1'))
    const body = res.data as Record<string, unknown>
    expect(body.passRate).toBe(0.25)
    expect(body.totalRuns).toBe(4)
  })
})
