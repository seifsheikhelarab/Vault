import { createFileRoute, Link, useNavigate, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCreateExpense, useCreateClaim, useCategories, useGroups } from '../lib/hooks'
import { authClient } from '../lib/auth-client'
import { ReceiptUpload } from '../components/receipt-upload'

export const Route = createFileRoute('/expenses/new')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: NewExpense,
})

function NewExpense() {
  const navigate = useNavigate()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [scope, setScope] = useState<'personal' | 'company'>('personal')
  const [departmentId, setDepartmentId] = useState('')
  const [submitAsClaim, setSubmitAsClaim] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [shakeField, setShakeField] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [isClaim, setIsClaim] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const createExpense = useCreateExpense()
  const createClaim = useCreateClaim()
  const { data: categories = [] } = useCategories()
  const { data: groups = [] } = useGroups()

  // Filter to only department-type groups for company scope
  const departments = useMemo(
    () => groups.filter(g => g.kind === 'department'),
    [groups]
  )

  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  const triggerShake = useCallback((field: string) => {
    setShakeField(field)
    setTimeout(() => setShakeField(null), 300)
  }, [])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!amount || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount'
    if (!description.trim()) errs.description = 'Description is required'
    if (!categoryId) errs.category = 'Select a category'
    if (!date) errs.date = 'Date is required'
    if (scope === 'company' && !departmentId) errs.department = 'Select a department'
    setErrors(errs)
    Object.keys(errs).forEach(triggerShake)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      // Step 1: Create the expense
      const expense = await createExpense.mutateAsync({
        amount: parseFloat(amount),
        description: description.trim(),
        categoryId,
        date: new Date(date).toISOString(),
        scope,
        groupId: departmentId || undefined,
        receiptUrl: receiptUrl || undefined,
      })

      // Step 2: If company scope + opted to claim, create the claim
      if (scope === 'company' && submitAsClaim && expense?.id) {
        await createClaim.mutateAsync({ expenseId: expense.id })
        setIsClaim(true)
      } else {
        setIsClaim(false)
      }

      setShowSuccess(true)
      setTimeout(() => navigate({ to: '/expenses' }), 1400)
    } catch (err: any) {
      setErrors({ submit: err?.message ?? 'Failed to create expense' })
      setSubmitting(false)
    }
  }

  const fieldClass = (field: string) => {
    const base = 'w-full px-4 py-3 bg-white border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all duration-200 shadow-warm-sm'
    const border = errors[field] ? 'border-error' : 'border-border'
    const shake = shakeField === field ? 'is-shaking' : 't-input'
    return `${base} ${border} ${shake}`
  }

  const isPending = submitting || createExpense.isPending

  return (
    <div className="max-w-lg mx-auto" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="t-success-check" data-state="in">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="38" stroke={isClaim ? '#FFB340' : '#34C759'} strokeWidth="3" fill="none" />
                <path d="M24 40 L35 51 L56 30" stroke={isClaim ? '#FFB340' : '#34C759'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-text-primary">
              {isClaim ? 'Claim submitted!' : 'Expense added!'}
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              {isClaim ? 'Waiting for approval' : 'Saved to your records'}
            </p>
          </div>
        </div>
      )}

      <div className="mb-8 t-stagger" ref={el => { if (el) requestAnimationFrame(() => el.classList.add('is-shown')) }} style={{ viewTransitionName: 'page-header' }}>
        <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Add Expense</h1>
        <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">Record a new expense</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-[16px] p-6 shadow-warm-sm border border-border-light space-y-6" style={{ transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s' }}>
        {errors.submit && (
          <div className="p-3 rounded-[10px] bg-error/10 border border-error/20 text-sm text-error font-medium">
            {errors.submit}
          </div>
        )}

        {/* Scope Toggle */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Type</label>
          <div className="flex gap-2 p-1 bg-cream/60 rounded-[10px]">
            {(['personal', 'company'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  setScope(opt)
                  if (opt === 'personal') {
                    setDepartmentId('')
                    setSubmitAsClaim(false)
                  }
                }}
                className={`flex-1 py-2.5 px-4 rounded-[8px] text-sm font-medium transition-all duration-200 ${
                  scope === opt
                    ? 'bg-white text-text-primary shadow-warm-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {opt === 'personal' ? 'Personal' : 'Company'}
              </button>
            ))}
          </div>
        </div>

        {/* Department Picker (company scope) */}
        {scope === 'company' && (
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Department</label>
            {departments.length === 0 ? (
              <div className="p-4 rounded-[10px] bg-cream/40 text-sm text-text-tertiary text-center">                  No departments available.{' '}
                <Link to="/groups/new" className="text-coral font-medium hover:underline">Create one</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {departments.map(dept => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setDepartmentId(dept.id)}
                    className={`flex items-center gap-2 p-3 rounded-[10px] border-2 transition-all duration-200 ${
                      departmentId === dept.id
                        ? 'border-coral bg-coral-light/50 text-coral shadow-warm-glow'
                        : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-[8px] bg-coral-light/60 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                      </svg>
                    </div>
                    <span className="text-xs font-semibold truncate">{dept.name}</span>
                  </button>
                ))}
              </div>
            )}
            {errors.department && <p className="t-error-msg text-xs text-error mt-1.5">{errors.department}</p>}
          </div>
        )}

        {/* Submit as Claim toggle (company scope) */}
        {scope === 'company' && departmentId && (
          <label className="flex items-start gap-3 p-4 rounded-[10px] bg-warm-white border border-border-light cursor-pointer hover:bg-cream/50 transition-colors duration-200 group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={submitAsClaim}
                onChange={e => setSubmitAsClaim(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-[6px] border-2 transition-all duration-200 flex items-center justify-center ${
                submitAsClaim
                  ? 'bg-coral border-coral'
                  : 'border-border group-hover:border-coral-light'
              }`}>
                {submitAsClaim && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-text-primary">Submit as claim</span>
              <p className="text-xs text-text-tertiary mt-0.5">
                Request reimbursement from the department budget. An admin will review and approve.
              </p>
            </div>
          </label>
        )}

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-mono text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-3 bg-white border border-border rounded-[10px] text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all duration-200 shadow-warm-sm"
            />
          </div>
          {errors.amount && <p className="t-error-msg text-xs text-error mt-1.5">{errors.amount}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Description</label>
          <div className="t-input-wrap">
            <input
              type="text"
              placeholder="What was this expense for?"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={fieldClass('description')}
            />
            {errors.description && <p className="t-error-msg text-xs text-error mt-1.5">{errors.description}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                type="button"
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                data-cuelume-hover="tick"
                className={`flex flex-col items-center gap-1.5 p-3.5 rounded-[10px] border-2 transition-all duration-200 ${
                  categoryId === cat.id
                    ? 'border-coral bg-coral-light/50 text-coral shadow-warm-glow'
                    : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                }`}
              >
                <span className="text-xl">{cat.icon ?? '📁'}</span>
                <span className="text-xs font-semibold">{cat.name}</span>
              </button>
            ))}
          </div>
          {errors.category && <p className="t-error-msg text-xs text-error mt-1.5">{errors.category}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={fieldClass('date')}
          />
          {errors.date && <p className="t-error-msg text-xs text-error mt-1.5">{errors.date}</p>}
        </div>

        {/* Receipt Upload */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Receipt (optional)</label>
          <ReceiptUpload value={receiptUrl} onChange={setReceiptUrl} />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/expenses' })}
            className="flex-1 px-5 py-3 bg-white border border-border text-text-secondary text-sm font-medium rounded-[10px] hover:bg-cream transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            data-cuelume-press="pop"
            className="flex-1 px-5 py-3 bg-gradient-to-r from-coral to-coral-dark text-white text-sm font-semibold rounded-[10px] hover:shadow-warm-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
          >
            {isPending
              ? submitAsClaim ? 'Submitting claim...' : 'Adding...'
              : submitAsClaim ? 'Submit Claim' : 'Add Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}
