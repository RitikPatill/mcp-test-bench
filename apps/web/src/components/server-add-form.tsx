'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function ServerAddForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'stdio' | 'sse'>('stdio')
  const [command, setCommand] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const config =
      type === 'stdio'
        ? { type: 'stdio' as const, command, args: command.split(' ').slice(1), env: {} }
        : { type: 'sse' as const, url }

    // For stdio, command should be the first token
    const finalConfig =
      type === 'stdio'
        ? {
            type: 'stdio' as const,
            command: command.trim().split(/\s+/)[0],
            args: command.trim().split(/\s+/).slice(1),
          }
        : { type: 'sse' as const, url }

    void config

    try {
      const res = await fetch('/api/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config: finalConfig }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add server')
        return
      }

      router.push(`/servers/${data.id}`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg">
        Add Server
      </Button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border bg-white p-6 shadow-sm space-y-4 w-full max-w-md"
    >
      <h2 className="text-lg font-semibold">Add MCP Server</h2>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="server-name">
          Name
        </label>
        <input
          id="server-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My filesystem server"
          required
          className="w-full rounded border px-3 py-1.5 text-sm"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Type</label>
        <div className="flex gap-4">
          {(['stdio', 'sse'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                disabled={loading}
              />
              {t.toUpperCase()}
            </label>
          ))}
        </div>
      </div>

      {type === 'stdio' ? (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="server-command">
            Command
          </label>
          <input
            id="server-command"
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="npx -y @modelcontextprotocol/server-filesystem /tmp"
            required
            className="w-full rounded border px-3 py-1.5 font-mono text-sm"
            disabled={loading}
          />
        </div>
      ) : (
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="server-url">
            URL
          </label>
          <input
            id="server-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:3001/sse"
            required
            className="w-full rounded border px-3 py-1.5 font-mono text-sm"
            disabled={loading}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Connecting…' : 'Add & Discover'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
