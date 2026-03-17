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
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              value === opt.value
                ? 'bg-white dark:bg-neutral-700 text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
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
