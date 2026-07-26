import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useSettlements } from '../lib/hooks'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/settlements')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: SettlementsList,
})

function SettlementsList() {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  const { data: settlements = [], isLoading } = useSettlements()

  return (
    <div className="space-y-6" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      <div className="t-stagger" ref={el => { if (el) requestAnimationFrame(() => el.classList.add('is-shown')) }}>
        <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Settlements</h1>
        <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">Payment history across all groups</p>
      </div>

      <div className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 rounded-[16px] bg-cream animate-pulse mb-5" />
            <div className="h-5 w-32 bg-cream rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-48 bg-cream/60 rounded-lg animate-pulse" />
          </div>
        ) : settlements.length > 0 ? (
          <div className="divide-y divide-border-light">
            {settlements.map((s, i) => (
              <div
                key={s.id}
                className="px-6 py-5 hover:bg-cream/40 transition-colors duration-150"
                style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.2 + i * 0.05}s` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      You paid {s.toUserId.slice(0, 8)}
                    </p>
                    {s.note && <p className="text-xs text-text-tertiary mt-0.5">{s.note}</p>}
                    <p className="text-xs text-text-tertiary mt-0.5">{new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="font-mono font-semibold text-sm text-text-primary">
                    ${Number(s.amount).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-[16px] bg-coral-light/60 flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No settlements yet</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
              Settle up from a group's balance page. Go to a group to see who owes whom.
            </p>
            <Link
              to="/groups"
              data-cuelume-hover="tick"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md"
            >
              View Groups
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
