import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useCreateGroup } from '../lib/hooks'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/groups/new')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: NewGroup,
})

function NewGroup() {
  const [revealed, setRevealed] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'social' | 'department'>('social')
  const navigate = useNavigate()
  const createGroup = useCreateGroup()

  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createGroup.mutate(
      { name: name.trim(), kind },
      { onSuccess: (group) => navigate({ to: '/groups/$groupId', params: { groupId: group.id } }) }
    )
  }

  return (
    <div className="max-w-lg mx-auto" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      <div className="t-stagger" ref={el => { if (el) requestAnimationFrame(() => el.classList.add('is-shown')) }}>
        <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Create Group</h1>
        <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">Start splitting expenses with others</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 bg-white rounded-[16px] shadow-warm-sm border border-border-light p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Group Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Roommates, Trip to Tokyo"
            autoFocus
            className="w-full px-4 py-2.5 bg-white border-b border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral transition-colors duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Type</label>
          <div className="flex gap-3">
            {(['social', 'department'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => setKind(opt)}
                className={`flex-1 py-2.5 px-4 rounded-[10px] text-sm font-medium border transition-all duration-200 ${
                  kind === opt
                    ? 'border-coral bg-coral-light/30 text-coral'
                    : 'border-border-light bg-white text-text-secondary hover:bg-cream/50'
                }`}
              >
                {opt === 'social' ? 'Social' : 'Department'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            to="/groups"
            className="px-5 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!name.trim() || createGroup.isPending}
            className="flex-1 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createGroup.isPending ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  )
}
