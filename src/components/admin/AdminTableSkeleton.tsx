import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminTableSkeletonProps {
  rows?: number
  cols?: number
  className?: string
}

export function AdminTableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: AdminTableSkeletonProps) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/20 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-border/50 last:border-b-0">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div
                    className={cn(
                      'h-4 rounded bg-muted/60 animate-pulse',
                      j === 0 ? 'w-24' : j === 1 ? 'w-32' : 'w-20'
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
