import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg'
  interactive?: boolean
  hoverLift?: boolean
}

const paddings: Record<string, string> = {
  none: '',
  xs: 'p-3',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
}

export default function Card({
  children,
  className = '',
  padding = 'md',
  interactive = false,
  hoverLift = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-white border border-slate-200/90 rounded-xl shadow-xs transition-all duration-180
        ${interactive ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''}
        ${hoverLift ? 'hover-lift' : ''}
        ${paddings[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}
