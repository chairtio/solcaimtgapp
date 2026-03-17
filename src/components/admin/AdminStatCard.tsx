import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  delta?: { value: string; positive?: boolean }
}

const AdminStatCard = React.forwardRef<HTMLDivElement, AdminStatCardProps>(
  ({ label, value, delta, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border/40 bg-card p-5 shadow-sm transition-colors duration-150',
        className
      )}
      {...props}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {delta && (
        <p
          className={cn(
            'mt-1 text-sm font-medium',
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
