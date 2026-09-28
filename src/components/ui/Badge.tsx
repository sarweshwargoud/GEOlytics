import type { ReactNode } from 'react'

type Variant = 'info' | 'success' | 'warning' | 'danger' | 'seo' | 'geo' | 'neutral'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

const styles: Record<Variant, string> = {
  info: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger)]',
  seo: 'bg-[var(--color-seo-light)] text-[var(--color-seo)]',
  geo: 'bg-[var(--color-geo-light)] text-[var(--color-geo)]',
  neutral: 'bg-gray-100 text-gray-700',
}

export default function Badge({ variant = 'info', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
