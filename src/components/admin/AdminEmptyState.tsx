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
        'flex flex-col items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 py-20 text-center shadow-sm',
        className
      )}
      {...props}
    >
      <Icon className="mb-5 h-12 w-12 text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
)
AdminEmptyState.displayName = 'AdminEmptyState'

export { AdminEmptyState }
