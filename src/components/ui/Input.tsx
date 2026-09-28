import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  icon?: ReactNode
}

export default function Input({
  label,
  error,
  helperText,
  icon,
  id,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 tracking-tight"
        >
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-xs">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <input
          id={id}
          className={`w-full text-sm bg-white border rounded-lg transition-all duration-150
            placeholder:text-slate-400 text-slate-900
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600
            ${icon ? 'pl-9 pr-3.5 py-2' : 'px-3.5 py-2'}
            ${
              error
                ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-600'
                : 'border-slate-200/90 hover:border-slate-300'
            }
            ${className}`}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
    </div>
  )
}
