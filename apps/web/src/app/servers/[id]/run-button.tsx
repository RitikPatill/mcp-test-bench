'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RunButton({ scenarioId }: { scenarioId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      })
      if (res.ok) {
        const { runId } = await res.json()
        router.push(`/runs/${runId}`)
      } else {
        const { error } = await res.json()
        alert(`Failed to start run: ${error}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mt-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
    >
      {loading ? 'Starting…' : 'Run'}
    </button>
  )
}
