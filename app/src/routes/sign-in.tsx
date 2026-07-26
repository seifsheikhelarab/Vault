import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn, authClient } from '../lib/auth-client'

export const Route = createFileRoute('/sign-in')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (data?.user) throw redirect({ to: '/dashboard' })
  },
  component: SignIn,
})

function SignIn() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn.email({ email, password, callbackURL: '/dashboard' })
      if (result.error) {
        setError(result.error.message ?? 'Invalid email or password')
      } else {
        navigate({ to: '/dashboard' })
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-white flex">
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-16">
        <div className="w-full max-w-[340px]">
          <Link to="/" className="inline-flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-[8px] bg-coral flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <span className="font-bold text-lg text-text-primary tracking-tight">Vault</span>
          </Link>

          <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1.5">Sign in</h1>
          <p className="text-sm text-text-secondary mb-10">Welcome back. Your expenses are waiting.</p>

          {error && (
            <div className="mb-6 px-4 py-2.5 rounded-[8px] bg-error/8 border border-error/15 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-0 py-2.5 bg-transparent border-0 border-b border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral transition-colors duration-200"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">Password</label>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-0 py-2.5 bg-transparent border-0 border-b border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral transition-colors duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-text-secondary mt-8">
            No account yet?{' '}
            <Link to="/sign-up" className="text-coral font-semibold hover:text-coral-dark transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>

      {/* Right: decorative panel */}
      <div className="hidden lg:flex flex-1 bg-cream/60 items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-coral/6 blur-3xl" />
        <div className="relative text-center max-w-[280px]">
          <div className="w-16 h-16 rounded-[16px] bg-coral/10 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-coral">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            Track every dollar. Split bills without the awkward math. See where your money goes.
          </p>
        </div>
      </div>
    </div>
  )
}
