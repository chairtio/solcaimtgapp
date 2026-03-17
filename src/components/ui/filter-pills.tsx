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
      <div className="inline-flex items-center gap-0.5 rounded-lg border-2 border-border bg-muted/50 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              value === opt.value
                ? 'bg-card text-foreground shadow-sm border border-border'
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
