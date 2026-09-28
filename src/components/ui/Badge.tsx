import type { ReactNode } from 'react'

type Variant = 'info' | 'success' | 'warning' | 'danger' | 'seo' | 'geo' | 'neutral' | 'purple'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
  dot?: boolean
}

const styles: Record<Variant, { bg: string; text: string; dot: string; border: string }> = {
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    border: 'border-blue-200/60',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200/60',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    dot: 'bg-amber-500',
    border: 'border-amber-200/60',
  },
  danger: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    border: 'border-rose-200/60',
  },
  seo: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-600',
    border: 'border-blue-200/60',
  },
  geo: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    dot: 'bg-purple-600',
    border: 'border-purple-200/60',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    dot: 'bg-purple-600',
    border: 'border-purple-200/60',
  },
  neutral: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
  },
}

export default function Badge({
  variant = 'info',
  children,
  className = '',
  dot = false,
}: BadgeProps) {
  const current = styles[variant] || styles.info
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${current.bg} ${current.text} ${current.border} transition-colors ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.dot}`} />}
      {children}
    </span>
  )
}
