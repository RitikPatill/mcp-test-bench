/**
 * In-process pub/sub broker keyed by runId.
 * Process-local: works for single-machine `pnpm dev`.
 * For multi-process or production, swap for Redis pub/sub.
 */
import type { RunEvent } from '@mcp-test-bench/core'

type Listener = (event: RunEvent) => void

const listeners = new Map<string, Set<Listener>>()

export function subscribe(runId: string, fn: Listener): () => void {
  if (!listeners.has(runId)) {
    listeners.set(runId, new Set())
  }
  listeners.get(runId)!.add(fn)
  return () => {
    listeners.get(runId)?.delete(fn)
  }
}

export function publish(runId: string, event: RunEvent): void {
  listeners.get(runId)?.forEach((fn) => fn(event))
}
