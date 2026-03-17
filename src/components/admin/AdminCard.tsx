import * as React from 'react'
import { cn } from '@/lib/utils'

interface AdminCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
}

const AdminCard = React.forwardRef<HTMLDivElement, AdminCardProps>(
  ({ className, title, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border/40 bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {title && (
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold leading-none tracking-tight">{title}</h3>
        </div>
      )}
      {children && (
        <div className={cn(title ? 'p-6 pt-0' : 'p-6')}>{children}</div>
      )}
    </div>
  )
)
AdminCard.displayName = 'AdminCard'

const AdminCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pb-4', className)} {...props} />
))
AdminCardHeader.displayName = 'AdminCardHeader'

const AdminCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-semibold leading-none tracking-tight', className)}
    {...props}
  />
))
AdminCardTitle.displayName = 'AdminCardTitle'

const AdminCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
AdminCardContent.displayName = 'AdminCardContent'

export { AdminCard, AdminCardHeader, AdminCardTitle, AdminCardContent }
