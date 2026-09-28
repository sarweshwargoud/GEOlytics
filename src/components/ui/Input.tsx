import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export default function Input({ label, error, id, className = '', ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-[var(--color-text-secondary)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-3 py-2 text-sm bg-[var(--color-surface)] border rounded-lg transition-colors
          focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent
          placeholder:text-[var(--color-text-tertiary)]
          ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
          ${className}`}
        {...props}
      />
      {error && (
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  )
}
