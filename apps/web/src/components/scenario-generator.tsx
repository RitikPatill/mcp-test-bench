'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface ScenarioGeneratorProps {
  serverId: string
}

export function ScenarioGenerator({ serverId }: ScenarioGeneratorProps) {
  const router = useRouter()
  const [count, setCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState<number | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setGenerated(null)

    try {
      const res = await fetch(`/api/servers/${serverId}/generate-scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Generation failed')
        return
      }

      setGenerated(data.generated as number)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded border bg-white p-4 shadow-sm space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">Generate scenarios</h2>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600" htmlFor="scenario-count">
          Count
        </label>
        <input
          id="scenario-count"
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="w-20 rounded border px-2 py-1 text-sm"
          disabled={loading}
        />
        <Button onClick={handleGenerate} disabled={loading} size="sm">
          {loading ? 'Generating…' : 'Generate scenarios'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {generated !== null && (
        <p className="text-sm text-green-700">Generated {generated} scenario(s).</p>
      )}
    </div>
  )
}
