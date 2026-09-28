import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

const base =
  'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]'

const variants: Record<string, string> = {
  primary:
    'bg-blue-600 text-white shadow-xs hover:bg-blue-700 hover:shadow-sm active:bg-blue-800',
  secondary:
    'bg-white text-slate-700 border border-slate-200/90 shadow-xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300',
  outline:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:text-slate-900',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:
    'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
}

const sizes: Record<string, string> = {
  xs: 'text-xs px-2 py-1 rounded gap-1',
  sm: 'text-xs font-medium px-3 py-1.5 rounded-md gap-1.5',
  md: 'text-sm font-medium px-4 py-2 rounded-lg gap-2',
  lg: 'text-sm font-semibold px-5 py-2.5 rounded-lg gap-2',
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
        <span className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin mr-0.5 shrink-0" />
      )}
      {children}
    </button>
  )
}
