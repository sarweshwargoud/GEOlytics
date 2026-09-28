import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

// ─── Loading State ──────────────────────────────────────

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
      <Loader2 size={24} className="animate-spin mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ─── Error State ────────────────────────────────────────

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--color-danger-light)] flex items-center justify-center mb-3">
        <span className="text-[var(--color-danger)] text-lg font-bold">!</span>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-[var(--color-primary-600)] font-medium hover:underline"
        >
          Try again
        </button>
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
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mb-4">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
