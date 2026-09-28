import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Search, ArrowRight, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setSuccess('Check your email to confirm your account.')
      } else {
        await signIn(email, password)
        navigate('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-secondary)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary-600)] mb-4">
            <Search size={22} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            SEO+GEO Intelligence
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            AI-powered search visibility platform
          </p>
        </div>

        {/* Form Card */}
        <div className="card">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
            {isSignUp ? 'Create account' : 'Sign in'}
          </h2>

          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger)] text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-[var(--color-success-light)] text-[var(--color-success)] text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent placeholder:text-[var(--color-text-tertiary)]"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-transparent placeholder:text-[var(--color-text-tertiary)]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--color-primary-600)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-[var(--color-text-secondary)]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              className="text-[var(--color-primary-600)] font-medium hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
