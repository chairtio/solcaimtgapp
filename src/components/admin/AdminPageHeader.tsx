import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  actions?: React.ReactNode
}

const AdminPageHeader = React.forwardRef<HTMLDivElement, AdminPageHeaderProps>(
  ({ title, actions, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border',
        className
      )}
      {...props}
    >
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
)
AdminPageHeader.displayName = 'AdminPageHeader'

export { AdminPageHeader }
