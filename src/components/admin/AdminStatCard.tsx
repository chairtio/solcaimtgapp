import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  delta?: { value: string; positive?: boolean }
  size?: 'primary' | 'secondary'
}

const AdminStatCard = React.forwardRef<HTMLDivElement, AdminStatCardProps>(
  ({ label, value, delta, size = 'secondary', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-sm transition-colors duration-150',
        className
      )}
      {...props}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      <p className={cn("font-semibold tabular-nums text-foreground", size === 'primary' ? 'text-3xl' : 'text-2xl')}>{value}</p>
      {delta && (
        <p
          className={cn(
            'mt-2 text-sm font-medium',
            delta.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
          )}
        >
          {delta.value}
        </p>
      )}
    </div>
  )
)
AdminStatCard.displayName = 'AdminStatCard'

export { AdminStatCard }
