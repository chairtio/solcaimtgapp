'use client'

import { cn } from '@/lib/utils'
import { Button } from './button'

export interface FilterPillOption<T extends string> {
  value: T
  label: string
}

interface FilterPillsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: FilterPillOption<T>[]
  label?: string
  className?: string
}

export function FilterPills<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: FilterPillsProps<T>) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <div className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out',
              value === opt.value
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800'
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
