import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--color-primary-500)] disabled:opacity-50 disabled:cursor-not-allowed'

const variants: Record<string, string> = {
  primary:
    'bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]',
  secondary:
    'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-tertiary)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text-primary)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-red-700',
}

const sizes: Record<string, string> = {
  sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1.5',
  md: 'text-sm px-3.5 py-2 rounded-lg gap-2',
  lg: 'text-sm px-5 py-2.5 rounded-lg gap-2',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}
