import * as React from 'react'
import { cn } from '@/lib/utils'

const AdminTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="overflow-x-auto">
    <table
      ref={ref}
      className={cn('w-full text-sm', className)}
      {...props}
    />
  </div>
))
AdminTable.displayName = 'AdminTable'

const AdminTableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('', className)} {...props} />
))
AdminTableHeader.displayName = 'AdminTableHeader'

const AdminTableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('', className)} {...props} />
))
AdminTableBody.displayName = 'AdminTableBody'

const AdminTableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-border/50 transition-colors duration-150 hover:bg-muted/30',
      className
    )}
    {...props}
  />
))
AdminTableRow.displayName = 'AdminTableRow'

const AdminTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground',
      className
    )}
    {...props}
  />
))
AdminTableHead.displayName = 'AdminTableHead'

const AdminTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('px-6 py-4', className)} {...props} />
))
AdminTableCell.displayName = 'AdminTableCell'

export {
  AdminTable,
  AdminTableHeader,
  AdminTableBody,
  AdminTableRow,
  AdminTableHead,
  AdminTableCell,
}
