export const dynamic = 'force-dynamic'

import { subscribe } from '@/lib/run-broker'
import type { RunEvent } from '@mcp-test-bench/core'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await params

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: RunEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        if (event.type === 'run_completed' || event.type === 'run_failed') {
          unsubscribe()
          controller.close()
        }
      }

      const unsubscribe = subscribe(runId, send)

      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
