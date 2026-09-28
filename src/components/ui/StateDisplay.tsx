import type { ReactNode } from 'react'
import { Loader2, AlertTriangle, Inbox } from 'lucide-react'
import Button from './Button'

// ─── Loading Skeleton Primitives ────────────────────────

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-200/70 rounded-md animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-3.5 w-36" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 flex items-center gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20 ml-auto" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className={`h-4 ${j === 0 ? 'w-48' : j === cols - 1 ? 'w-16' : 'w-24'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Loading State ──────────────────────────────────────

export function LoadingState({
  message = 'Loading data...',
  type = 'spinner',
}: {
  message?: string
  type?: 'spinner' | 'skeleton'
}) {
  if (type === 'skeleton') {
    return (
      <div className="space-y-4 py-4 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-3 text-blue-600">
        <Loader2 size={20} className="animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <p className="text-xs text-slate-400 mt-0.5">Fetching latest intelligence</p>
    </div>
  )
}

// ─── Error State ────────────────────────────────────────

export function ErrorState({
  message = 'Unable to load data at this time.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-scale-in">
      <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-3 text-rose-600">
        <AlertTriangle size={20} />
      </div>
      <h4 className="text-sm font-semibold text-slate-900 mb-1">Encountered an issue</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-scale-in">
      <div className="w-12 h-12 rounded-xl bg-slate-100/80 border border-slate-200/80 flex items-center justify-center mb-3 text-slate-500 shadow-xs">
        {icon || <Inbox size={22} />}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
