import * as React from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

const AdminEmptyState = React.forwardRef<HTMLDivElement, AdminEmptyStateProps>(
  ({ icon: Icon, title, description, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-border/40 bg-card py-16 text-center',
        className
      )}
      {...props}
    >
      <Icon className="mb-4 h-12 w-12 text-muted-foreground/40" strokeWidth={1.25} />
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
)
AdminEmptyState.displayName = 'AdminEmptyState'

export { AdminEmptyState }
