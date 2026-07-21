'use client'

import { Select } from '@/components/ui/select'

interface RunFilterProps {
  tag: string
  status: string
  onChange: (filters: { tag: string; status: string }) => void
}

const TAGS = ['', 'happy-path', 'edge', 'adversarial']
const TAG_LABELS: Record<string, string> = {
  '': 'All tags',
  'happy-path': 'Happy path',
  edge: 'Edge',
  adversarial: 'Adversarial',
}

const STATUSES = ['', 'completed', 'failed', 'running', 'pending']
const STATUS_LABELS: Record<string, string> = {
  '': 'All statuses',
  completed: 'Completed',
  failed: 'Failed',
  running: 'Running',
  pending: 'Pending',
}

export function RunFilter({ tag, status, onChange }: RunFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Select
        value={tag}
        onChange={(e) => onChange({ tag: e.target.value, status })}
        className="w-36"
        aria-label="Filter by tag"
      >
        {TAGS.map((t) => (
          <option key={t} value={t}>
            {TAG_LABELS[t]}
          </option>
        ))}
      </Select>
      <Select
        value={status}
        onChange={(e) => onChange({ tag, status: e.target.value })}
        className="w-40"
        aria-label="Filter by status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
    </div>
  )
}
