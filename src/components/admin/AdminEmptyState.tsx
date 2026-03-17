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
        'flex flex-col items-center justify-center rounded-xl border border-border/20 bg-card py-20 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.2)]',
        className
      )}
      {...props}
    >
      <Icon className="mb-5 h-14 w-14 text-muted-foreground/50" strokeWidth={1.25} />
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
)
AdminEmptyState.displayName = 'AdminEmptyState'

export { AdminEmptyState }
