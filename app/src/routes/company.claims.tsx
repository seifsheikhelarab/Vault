import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useClaims, useApproveClaim, useRejectClaim, useReimburseClaim, useCategories } from '../lib/hooks'
import { useSession } from '../lib/auth-client'
import { authClient } from '../lib/auth-client'
import type { ClaimWithExpense } from '../lib/api'

export const Route = createFileRoute('/company/claims')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: ClaimsQueue,
})

const STATUS_TABS = ['All', 'submitted', 'approved', 'rejected', 'reimbursed'] as const

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-warning/15 text-warning border-warning/20',
  approved: 'bg-success/15 text-success border-success/20',
  rejected: 'bg-error/15 text-error border-error/20',
  reimbursed: 'bg-info/15 text-info border-info/20',
}

const STATUS_BADGE: Record<string, string> = {
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
}

function ClaimsQueue() {
  const [revealed, setRevealed] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [viewMode, setViewMode] = useState<'admin' | 'my'>('admin')
  const [rejectModal, setRejectModal] = useState<{ id: string; description: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const staggerRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const { data: session } = useSession()
  const currentUserId = session?.user?.id

  useEffect(() => {
    requestAnimationFrame(() => {
      setRevealed(true)
      staggerRef.current?.classList.add('is-shown')
    })
  }, [])

  const { data: claims = [], isLoading: claimsLoading } = useClaims(
    viewMode === 'my' && currentUserId ? { userId: currentUserId } : {}
  )
  const { data: categories = [] } = useCategories()
  const catMap = new Map(categories.map(c => [c.id, c.name]))

  const approveClaim = useApproveClaim()
  const rejectClaim = useRejectClaim()
  const reimburseClaim = useReimburseClaim()

  // Move pill for status tabs
  useEffect(() => {
    const idx = STATUS_TABS.indexOf(statusFilter as typeof STATUS_TABS[number])
    const tab = tabRefs.current[idx]
    const pill = pillRef.current
    if (!tab || !pill) return
    pill.style.width = `${tab.offsetWidth}px`
    pill.style.transform = `translateX(${tab.offsetLeft}px)`
  }, [statusFilter])

  const filtered = claims
    .filter(c => statusFilter === 'All' || c.status === statusFilter)

  const handleReject = () => {
    if (!rejectModal) return
    rejectClaim.mutate(
      { id: rejectModal.id, note: rejectNote || undefined },
      { onSuccess: () => { setRejectModal(null); setRejectNote('') } }
    )
  }

  if (claimsLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-cream rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-cream/60 rounded-lg animate-pulse" />
        </div>
        <div className="h-14 bg-cream/40 rounded-[10px] animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="t-stagger" ref={staggerRef}>
          <div className="flex items-center gap-2">
            <Link to="/company" className="text-sm text-text-tertiary hover:text-coral transition-colors">Company</Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-tertiary"><polyline points="9 18 15 12 9 6"/></svg>
            <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Claims</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
            {filtered.length} claim{filtered.length !== 1 ? 's' : ''}
            {statusFilter !== 'All' && ` · ${statusFilter}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-cream/60 rounded-[10px] p-1">
          <button
            onClick={() => setViewMode('admin')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-[8px] transition-all duration-200 ${
              viewMode === 'admin'
                ? 'bg-white text-text-primary shadow-warm-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            All Claims
          </button>
          <button
            onClick={() => setViewMode('my')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-[8px] transition-all duration-200 ${
              viewMode === 'my'
                ? 'bg-white text-text-primary shadow-warm-sm'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            My Claims
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="t-tabs">
        <span ref={pillRef} className="t-tabs-pill" />
        {STATUS_TABS.map((status, i) => (
          <button
            key={status}
            ref={el => { tabRefs.current[i] = el }}
            onClick={() => setStatusFilter(status)}
            aria-selected={statusFilter === status}
            className="t-tab capitalize"
          >
            {status === 'submitted' ? 'Pending' : status}
          </button>
        ))}
      </div>

      {/* Claims List */}
      <div className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <svg className="mx-auto mb-4 text-text-tertiary opacity-40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No claims found</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
              {statusFilter !== 'All'
                ? `No claims with status "${statusFilter}". Try a different filter.`
                : viewMode === 'my'
                  ? "You haven't submitted any claims yet."
                  : 'No claims have been submitted yet.'}
            </p>
            {viewMode === 'my' && (
              <Link
                to="/expenses/new"
                data-cuelume-hover="tick"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Submit Expense
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map((claim: ClaimWithExpense, i: number) => {
              const catName = catMap.get(claim.expense.categoryId) ?? 'Other'
              const isMyClaim = currentUserId && claim.expense.userId === currentUserId
              return (
                <div
                  key={claim.id}
                  className="px-6 py-5 hover:bg-cream/40 transition-colors duration-150 group"
                  style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.2 + i * 0.04}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text-primary truncate group-hover:text-coral transition-colors">
                          {claim.expense.description}
                        </p>
                        {isMyClaim && (
                          <span className="shrink-0 text-[10px] font-semibold text-text-tertiary bg-cream px-1.5 py-0.5 rounded-full">yours</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-text-primary">
                          ${Number(claim.expense.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-text-tertiary">{catName}</span>
                        <span className="text-xs text-text-tertiary">{new Date(claim.expense.date).toLocaleDateString()}</span>
                        {claim.reviewNote && (
                          <span className="text-xs text-text-tertiary italic">· "{claim.reviewNote}"</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[claim.status] ?? ''}`}>
                        {STATUS_BADGE[claim.status] ?? claim.status}
                      </span>

                      {/* Admin actions for submitted claims */}
                      {claim.status === 'submitted' && viewMode === 'admin' && (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button
                            onClick={() => approveClaim.mutate(claim.id)}
                            disabled={approveClaim.isPending}
                            data-cuelume-press="pop"
                            className="px-3 py-1.5 bg-success/10 text-success text-xs font-semibold rounded-[8px] border border-success/20 hover:bg-success/20 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectModal({ id: claim.id, description: claim.expense.description })
                              setRejectNote('')
                            }}
                            className="px-3 py-1.5 bg-error/10 text-error text-xs font-semibold rounded-[8px] border border-error/20 hover:bg-error/20 active:scale-[0.97] transition-all duration-150"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {/* Admin action for approved claims */}
                      {claim.status === 'approved' && viewMode === 'admin' && (
                        <button
                          onClick={() => reimburseClaim.mutate(claim.id)}
                          disabled={reimburseClaim.isPending}
                          data-cuelume-press="pop"
                          className="ml-2 px-3 py-1.5 bg-info/10 text-info text-xs font-semibold rounded-[8px] border border-info/20 hover:bg-info/20 active:scale-[0.97] transition-all duration-150 disabled:opacity-50"
                        >
                          Mark Reimbursed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-text-primary mb-2">Reject Claim</h3>
            <p className="text-sm text-text-secondary mb-4">{rejectModal.description}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Reason (optional)</label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Why is this claim being rejected?"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all duration-200 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setRejectModal(null)}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={rejectClaim.isPending}
                  className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {rejectClaim.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
