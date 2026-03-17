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
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-muted/40 p-1">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-9 rounded-md px-3 text-sm font-medium transition-colors duration-150',
              value === opt.value
                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
