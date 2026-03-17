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
    <div className={cn('overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-5 py-3 text-left">
                <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0">
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-5 py-3.5">
                  <div
                    className={cn(
                      'h-4 rounded bg-neutral-200 dark:bg-neutral-700 animate-pulse',
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
