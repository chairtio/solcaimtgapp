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
        'rounded-xl border border-border/20 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-colors duration-150',
        className
      )}
      {...props}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-semibold tabular-nums text-foreground", size === 'primary' ? 'text-3xl' : 'text-2xl')}>{value}</p>
      {delta && (
        <p
          className={cn(
            'mt-2 text-sm font-medium',
            delta.positive ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
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
