'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface CompareBarProps {
  selectedIds: string[]
  onClear: () => void
}

export function CompareBar({ selectedIds, onClear }: CompareBarProps) {
  const router = useRouter()

  if (selectedIds.length === 0) return null

  const handleCompare = () => {
    router.push(`/compare?ids=${selectedIds.join(',')}`)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-8 py-3">
        <span className="text-sm text-muted-foreground">
          {selectedIds.length} server{selectedIds.length !== 1 ? 's' : ''} selected
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear
          </Button>
          <Button size="sm" onClick={handleCompare} disabled={selectedIds.length < 2}>
            Compare ({selectedIds.length})
          </Button>
        </div>
      </div>
    </div>
  )
}
