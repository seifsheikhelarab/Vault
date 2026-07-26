import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useGroups } from '../lib/hooks'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/groups')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: Groups,
})

function Groups() {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  const { data: groups = [], isLoading } = useGroups()

  return (
    <div className="space-y-6" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      <div className="flex items-center justify-between">
        <div className="t-stagger" ref={el => { if (el) requestAnimationFrame(() => el.classList.add('is-shown')) }}>
          <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Groups</h1>
          <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">Split expenses with friends and family</p>
        </div>
        <Link
          to="/groups/new"
          data-cuelume-hover="tick"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Group
        </Link>
      </div>

      <div className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-16 h-16 rounded-[16px] bg-cream animate-pulse mb-5" />
            <div className="h-5 w-32 bg-cream rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-48 bg-cream/60 rounded-lg animate-pulse" />
          </div>
        ) : groups.length > 0 ? (
          <div className="divide-y divide-border-light">
            {groups.map((group, i) => (
              <Link
                key={group.id}
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                className="block px-6 py-5 hover:bg-cream/40 transition-colors duration-150 group"
                style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.2 + i * 0.05}s` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-coral-light/60 flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary group-hover:text-coral transition-colors">{group.name}</p>
                      <p className="text-xs text-text-tertiary mt-0.5 capitalize">{group.kind} group · Created {new Date(group.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary group-hover:text-coral transition-colors">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-[16px] bg-coral-light/60 flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No groups yet</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
              Create a group to start splitting expenses with friends, roommates, or travel buddies.
            </p>
            <Link
              to="/groups/new"
              data-cuelume-hover="tick"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Group
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
