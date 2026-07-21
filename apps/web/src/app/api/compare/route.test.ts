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
  servers: {},
  runs: {},
  judgements: {},
  findings: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}))

const { GET } = await import('./route')

function makeRequest(ids: string) {
  return new Request(`http://localhost/api/compare?ids=${ids}`)
}

describe('GET /api/compare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when fewer than 2 IDs provided', async () => {
    const res = await GET(makeRequest('abc'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no IDs provided', async () => {
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(400)
  })

  it('returns comparison data array for two valid server IDs', async () => {
    const serverA = { id: 'a', name: 'Server A', config: { type: 'stdio' } }
    const serverB = { id: 'b', name: 'Server B', config: { type: 'stdio' } }

    let globalCallCount = 0
    mockDb.select.mockImplementation(() => {
      globalCallCount++
      const callIdx = globalCallCount

      // Queries per server: 1=server, 2=latestJudgement, 3=runRows, 4=findingRows
      // For server A: calls 1-4, for server B: calls 5-8
      const serverCallIdx = ((callIdx - 1) % 4) + 1
      const isServerA = callIdx <= 4

      if (serverCallIdx === 1) {
        // Server lookup
        const srv = isServerA ? serverA : serverB
        return {
          from: () => ({
            where: () => ({ get: async () => srv }),
          }),
        }
      }
      if (serverCallIdx === 2) {
        // Latest judgement
        return {
          from: () => ({
            leftJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    get: async () => ({
                      overallScore: 800,
                      criteriaScores: [{ name: 'Correctness', score: 80, reasoning: 'good' }],
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (serverCallIdx === 3) {
        // Run counts
        return {
          from: () => ({
            where: () => ({
              all: async () => [{ status: 'completed' }, { status: 'completed' }],
            }),
          }),
        }
      }
      // Finding counts
      return {
        from: () => ({
          where: () => ({
            all: async () => [{ severity: 'warn' }],
          }),
        }),
      }
    })

    const res = await GET(makeRequest('a,b'))
    expect(res.status).toBe(200)
    const body = res.data as Array<Record<string, unknown>>
    expect(body).toHaveLength(2)
    expect(body[0]!.id).toBe('a')
    expect(body[1]!.id).toBe('b')
    expect(body[0]!.latestScore).toBe(8)
    expect(body[0]!.criteriaScores).toBeDefined()
    expect(body[0]!.findingCounts).toEqual({ critical: 0, warn: 1, info: 0 })
  })
})
