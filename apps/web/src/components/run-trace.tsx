'use client'

import { useEffect, useState } from 'react'
import type { RunEvent } from '@mcp-test-bench/core'

interface TurnData {
  index: number
  toolCalls: Array<{ toolUseId: string; toolName: string; toolInput: unknown }>
  toolResults: Array<{ toolUseId: string; toolName: string; result: unknown; isError: boolean }>
}

interface RunTraceProps {
  runId: string
  initialTurns: TurnData[]
  initialStatus: string
}

export function RunTrace({ runId, initialTurns, initialStatus }: RunTraceProps) {
  const [turns, setTurns] = useState<TurnData[]>(initialTurns)
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialStatus === 'completed' || initialStatus === 'failed') return

    const es = new EventSource(`/api/runs/${runId}/stream`)

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data) as RunEvent

      if (event.type === 'turn_started') {
        setTurns((prev) => {
          const exists = prev.some((t) => t.index === event.turnIndex)
          if (exists) return prev
          return [...prev, { index: event.turnIndex, toolCalls: [], toolResults: [] }]
        })
      }

      if (event.type === 'tool_call') {
        setTurns((prev) =>
          prev.map((t) =>
            t.index === event.turnIndex
              ? {
                  ...t,
                  toolCalls: [
                    ...t.toolCalls,
                    {
                      toolUseId: event.toolUseId,
                      toolName: event.toolName,
                      toolInput: event.toolInput,
                    },
                  ],
                }
              : t,
          ),
        )
      }

      if (event.type === 'tool_result') {
        setTurns((prev) =>
          prev.map((t) =>
            t.index === event.turnIndex
              ? {
                  ...t,
                  toolResults: [
                    ...t.toolResults,
                    {
                      toolUseId: event.toolUseId,
                      toolName: event.toolName,
                      result: event.result,
                      isError: event.isError,
                    },
                  ],
                }
              : t,
          ),
        )
      }

      if (event.type === 'run_completed') {
        setStatus('completed')
        es.close()
      }

      if (event.type === 'run_failed') {
        setStatus('failed')
        setError(event.error)
        es.close()
      }
    }

    es.onerror = () => es.close()

    return () => es.close()
  }, [runId, initialStatus])

  const statusColor =
    status === 'completed'
      ? 'bg-green-100 text-green-800'
      : status === 'failed'
        ? 'bg-red-100 text-red-800'
        : 'bg-yellow-100 text-yellow-800'

  return (
    <div className="space-y-4">
      <div className={`inline-flex rounded px-2 py-1 text-sm font-medium ${statusColor}`}>
        {status}
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {turns.map((turn) => (
          <div key={turn.index} className="rounded border bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-gray-500">Turn {turn.index + 1}</div>
            {turn.toolCalls.map((tc) => {
              const result = turn.toolResults.find((r) => r.toolUseId === tc.toolUseId)
              return (
                <div key={tc.toolUseId} className="mb-2 space-y-1">
                  <details className="rounded border bg-gray-50 p-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Tool call: <span className="font-mono text-blue-600">{tc.toolName}</span>
                    </summary>
                    <pre className="mt-2 overflow-auto text-xs text-gray-700">
                      {JSON.stringify(tc.toolInput, null, 2)}
                    </pre>
                  </details>
                  {result && (
                    <div
                      className={`rounded border p-2 text-xs ${result.isError ? 'border-red-300 bg-red-50' : 'border-green-200 bg-green-50'}`}
                    >
                      {result.isError && (
                        <span className="mb-1 inline-block rounded bg-red-200 px-1 text-red-800">
                          error
                        </span>
                      )}
                      <pre className="overflow-auto">{JSON.stringify(result.result, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )
            })}
            {turn.toolCalls.length === 0 && (
              <p className="text-sm text-gray-400 italic">No tool calls this turn.</p>
            )}
          </div>
        ))}
      </div>

      {turns.length === 0 && status === 'running' && (
        <p className="text-sm text-gray-500">Waiting for first turn…</p>
      )}
    </div>
  )
}
