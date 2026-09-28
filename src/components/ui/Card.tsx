import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

const paddings: Record<string, string> = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div
      className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm ${paddings[padding]} ${className}`}
    >
      {children}
    </div>
  )
}
