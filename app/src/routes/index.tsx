import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="relative py-24 lg:py-36 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-coral/4 blur-3xl" />
        </div>

        <div
          className="max-w-[800px] mx-auto px-6"
          style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(16px)', transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-text-primary tracking-tight leading-[1.05] mb-6">
            Expense tracking<br />that gets out of your way.
          </h1>

          <p className="text-lg text-text-secondary max-w-lg mb-10 leading-relaxed">
            Log expenses in seconds. See where your money goes. Split bills with friends without the awkward math.
          </p>

          <div className="flex items-center gap-3">
            <Link
              to="/sign-up"
              className="px-6 py-3 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200"
            >
              Get started free
            </Link>
            <Link
              to="/sign-in"
              className="px-6 py-3 text-text-secondary text-sm font-medium rounded-[10px] hover:text-text-primary transition-colors duration-200"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* What it does — editorial, not cards */}
      <section className="py-16 lg:py-24 border-t border-border-light">
        <div className="max-w-[800px] mx-auto px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-12 gap-x-16">
            <div>
              <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Personal</h3>
              <p className="text-text-primary text-base leading-relaxed">
                Categorize every purchase, set monthly budgets, and watch your spending with real charts. Not a spreadsheet, not a spreadsheet wrapper.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Groups</h3>
              <p className="text-text-primary text-base leading-relaxed">
                Create a group, add people, split any expense. See who owes what at a glance. Settle up when you're ready.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Company</h3>
              <p className="text-text-primary text-base leading-relaxed">
                Department budgets, expense submissions, approval workflows. For teams that need structure without the bureaucracy.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-coral uppercase tracking-wider mb-3">Built to last</h3>
              <p className="text-text-primary text-base leading-relaxed">
                Not a weekend hack. Real auth, real database, real deployments. The kind of stack you'd trust with your own money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28 border-t border-border-light">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary tracking-tight mb-4">Start tracking</h2>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">Free forever for personal use. No credit card, no trial, no gimmicks.</p>
          <Link
            to="/sign-up"
            className="inline-flex px-7 py-3.5 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-light py-8">
        <div className="max-w-[800px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[6px] bg-coral flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-text-primary">Vault</span>
          </div>
          <p className="text-xs text-text-tertiary">React, TanStack, Hono, Drizzle, PostgreSQL</p>
        </div>
      </footer>
    </div>
  )
}
