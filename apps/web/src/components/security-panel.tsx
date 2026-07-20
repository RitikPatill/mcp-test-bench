'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Finding } from '@mcp-test-bench/core'

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  info: 'bg-gray-100 text-gray-700 border-gray-200',
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warn: 1, info: 2 }

function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
    if (sevDiff !== 0) return sevDiff
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

interface SecurityPanelProps {
  serverId: string
  initialFindings: Finding[]
}

export function SecurityPanel({ serverId, initialFindings }: SecurityPanelProps) {
  const [findings, setFindings] = useState<Finding[]>(sortFindings(initialFindings))
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScan() {
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/scan`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Scan failed' }))
        throw new Error(body.error ?? 'Scan failed')
      }
      const data = await res.json()
      setFindings(sortFindings(data.findings ?? []))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setScanning(false)
    }
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const warnCount = findings.filter((f) => f.severity === 'warn').length

  return (
    <div className="space-y-4">
      {/* Scan button + summary */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          {findings.length === 0 ? (
            <span className="text-green-700 font-medium">No findings</span>
          ) : (
            <>
              {criticalCount > 0 && (
                <span className="text-red-700 font-medium">{criticalCount} critical</span>
              )}
              {warnCount > 0 && (
                <span className="text-yellow-700 font-medium">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
              )}
            </>
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {scanning ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              Scanning…
            </>
          ) : (
            'Run Security Scan'
          )}
        </button>
      </div>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {findings.length === 0 ? (
        <div className="rounded border border-green-200 bg-green-50 px-4 py-6 text-center">
          <p className="text-green-700 font-medium">✓ No findings — server looks clean.</p>
          <p className="text-sm text-green-600 mt-1">
            Run a security scan to check for prompt-injection patterns, unbounded outputs, and
            destructive tools.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded border bg-white p-4 shadow-sm space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-semibold ${SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.info}`}
                >
                  {finding.severity}
                </span>
                <span className="font-mono text-xs text-gray-500">{finding.category}</span>
              </div>
              <p className="text-sm font-semibold">{finding.title}</p>
              <p className="text-sm text-gray-600">{finding.detail}</p>
              <p className="font-mono text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 inline-block">
                {finding.location}
              </p>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-blue-600 hover:underline select-none">
                  How to fix
                </summary>
                <p className="mt-1 text-sm text-gray-700 pl-2 border-l-2 border-gray-200">
                  {finding.remediation}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
