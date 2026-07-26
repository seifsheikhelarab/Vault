import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useCompanySummary, useClaims, useCreateGroup, useDeleteGroup } from '../lib/hooks'
import { authClient } from '../lib/auth-client'
import type { CompanySummary, ClaimWithExpense } from '../lib/api'
export const Route = createFileRoute('/company')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: CompanyDashboard,
})

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-warning/15 text-warning border-warning/20',
  approved: 'bg-success/15 text-success border-success/20',
  rejected: 'bg-error/15 text-error border-error/20',
  reimbursed: 'bg-info/15 text-info border-info/20',
}

function CompanyDashboard() {
  const [revealed, setRevealed] = useState(false)
  const staggerRef = useRef<HTMLDivElement>(null)
  const [showCreateDept, setShowCreateDept] = useState(false)
  const [newDeptName, setNewDeptName] = useState('')
  const [deletingDept, setDeletingDept] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      setRevealed(true)
      staggerRef.current?.classList.add('is-shown')
    })
  }, [])

  const { data: summary, isLoading: summaryLoading } = useCompanySummary()
  const { data: recentClaims = [], isLoading: claimsLoading } = useClaims({ status: 'submitted' })
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()

  const handleCreateDepartment = () => {
    if (!newDeptName.trim()) return
    createGroup.mutate(
      { name: newDeptName.trim(), kind: 'department' },
      {
        onSuccess: () => {
          setShowCreateDept(false)
          setNewDeptName('')
        },
      }
    )
  }

  const handleDeleteDepartment = (id: string) => {
    setDeletingDept(id)
    deleteGroup.mutate(id, {
      onSettled: () => {
        setDeletingDept(null)
        setConfirmDelete(null)
      },
    })
  }

  const isLoading = summaryLoading || claimsLoading

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-cream rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-cream/60 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-white rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />)}
        </div>
        <div className="h-72 bg-white rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />
      </div>
    )
  }

  const hasDepartments = summary && summary.departments.length > 0

  if (!hasDepartments) {
    return (
      <div className="space-y-6" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
        <div className="t-stagger" ref={staggerRef}>
          <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Company</h1>
          <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">Department budgets and expense claims</p>
        </div>
        <div className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden" style={{ opacity: revealed ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s' }}>
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-[16px] bg-coral-light/60 flex items-center justify-center mb-5">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No departments set up</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
              Create a department group to manage budgets and expense claims for your team.
            </p>
            <button
              onClick={() => setShowCreateDept(true)}
              data-cuelume-hover="tick"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-coral to-coral-dark text-white text-sm font-semibold rounded-[10px] hover:shadow-warm-md active:scale-[0.98] transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Department
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { departments, totalBudget, totalSpent, pendingClaims } = summary!
  const remaining = totalBudget - totalSpent

  const SUMMARY_CARDS = [
    {
      label: 'Total Budget',
      value: `$${totalBudget.toLocaleString()}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
      color: 'text-success',
    },
    {
      label: 'Total Spent',
      value: `$${totalSpent.toLocaleString()}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
      color: 'text-coral',
    },
    {
      label: 'Remaining',
      value: `$${remaining.toLocaleString()}`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFB340" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      ),
      color: remaining < 0 ? 'text-error' : 'text-warning',
    },
    {
      label: 'Pending Claims',
      value: String(pendingClaims),
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5AC8FA" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
      color: 'text-info',
    },
  ]

  return (
    <div className="space-y-8" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="t-stagger" ref={staggerRef}>
          <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Company</h1>
          <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">{departments.length} departments · {pendingClaims} pending claim{pendingClaims !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/company/claims"
            data-cuelume-hover="tick"
            className="px-5 py-2.5 bg-white border border-border text-text-secondary text-sm font-medium rounded-[10px] hover:bg-cream hover:text-text-primary transition-all duration-200 shadow-warm-sm"
          >
            Claims Queue
            {pendingClaims > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral text-white text-xs font-bold">
                {pendingClaims}
              </span>
            )}
          </Link>
          <button
            onClick={() => setShowCreateDept(true)}
            data-cuelume-hover="tick"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Department
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map((card, i) => (
          <div
            key={card.label}
            className="bg-white rounded-[16px] p-5 shadow-warm-sm border border-border-light hover:shadow-warm-md transition-shadow duration-300"
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.06}s`,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-[10px] bg-warm-white flex items-center justify-center border border-border-light">
                {card.icon}
              </div>
              <span className="text-xs font-medium text-text-tertiary">{card.label}</span>
            </div>
            <div className="font-mono text-xl font-bold text-text-primary tracking-tight">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Overall Budget Progress */}
      <div
        className="bg-white rounded-[16px] p-6 shadow-warm-sm border border-border-light"
        style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-text-primary">Overall Budget</h2>
          <span className="text-xs font-mono text-text-secondary">
            ${totalSpent.toLocaleString()} / ${totalBudget.toLocaleString()}
          </span>
        </div>
        <div className="h-3 bg-cream rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%`,
              background: 'linear-gradient(90deg, #FF6B6B, #FFAB91)',
            }}
          />
        </div>
      </div>

      {/* Departments */}
      <div
        className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden"
        style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.35s' }}
      >
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Departments</h2>
        </div>
        <div className="divide-y divide-border-light">
          {departments.map((dept: CompanySummary['departments'][number], i: number) => (
            <div
              key={dept.id}
              className="px-6 py-5 hover:bg-cream/40 transition-colors duration-150 group"
              style={{ opacity: revealed ? 1 : 0, transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.4 + i * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-coral-light/60 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </div>
                  <div>
                    <Link
                      to="/groups/$groupId"
                      params={{ groupId: dept.id }}
                      className="text-sm font-medium text-text-primary group-hover:text-coral transition-colors"
                    >
                      {dept.name}
                    </Link>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {dept.memberCount} {dept.memberCount === 1 ? 'member' : 'members'} · {dept.expenseCount} expenses
                      {dept.role === 'admin' && <span className="ml-2 text-coral font-semibold">· admin</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono font-semibold text-sm text-text-primary">${dept.totalSpent.toLocaleString()}</p>
                    <p className="text-xs text-text-tertiary">of ${dept.totalBudget.toLocaleString()}</p>
                  </div>
                  {dept.role === 'admin' && (
                    <button
                      onClick={() => setConfirmDelete(dept.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded-[8px] text-text-tertiary hover:text-error hover:bg-error/10"
                      title="Delete department"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              <div className="h-2 bg-cream rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${dept.budgetUtilization}%`,
                    background: dept.budgetUtilization > 90
                      ? 'linear-gradient(90deg, #FFB340, #FF3B30)'
                      : 'linear-gradient(90deg, #FF6B6B, #FFAB91)',
                  }}
                />
              </div>
              {dept.pendingClaims > 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <span className="text-xs text-warning font-medium">{dept.pendingClaims} pending claim{dept.pendingClaims !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Pending Claims */}
      {recentClaims.length > 0 && (
        <div
          className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden"
          style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.45s' }}
        >
          <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Pending Claims</h2>
            <Link to="/company/claims" className="text-sm font-medium text-coral hover:text-coral-dark transition-colors">
              View all
            </Link>
          </div>
          <div className="divide-y divide-border-light">
            {recentClaims.slice(0, 5).map((claim: ClaimWithExpense, i: number) => (
              <div key={claim.id} className="px-6 py-4 hover:bg-cream/40 transition-colors duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{claim.expense.description}</p>
                    <p className="text-xs text-text-tertiary mt-0.5 font-mono">
                      ${Number(claim.expense.amount).toFixed(2)} · {new Date(claim.expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[claim.status] ?? ''}`}>
                    {claim.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Create Department Modal ─── */}
      {showCreateDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setShowCreateDept(false); setNewDeptName('') }}>
          <div className="bg-white rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-text-primary mb-4">Create Department</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Department Name</label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={e => setNewDeptName(e.target.value)}
                  placeholder="e.g. Engineering, Marketing"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateDepartment() }}
                  className="w-full px-4 py-2.5 bg-white border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all duration-200"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowCreateDept(false); setNewDeptName('') }}
                  className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDepartment}
                  disabled={!newDeptName.trim() || createGroup.isPending}
                  className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {createGroup.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4 mx-auto">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary text-center mb-2">Delete Department?</h3>
            <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">
              This will permanently delete this department and remove all its members. Expenses will be kept but unlinked.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDepartment(confirmDelete)}
                disabled={deletingDept === confirmDelete}
                className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
              >
                {deletingDept === confirmDelete ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
