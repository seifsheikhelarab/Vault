import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useExpenses, useCategories } from '../lib/hooks'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/expenses')({
  beforeLoad: async () => {
    const { data } = await authClient.getSession()
    if (!data?.user) throw redirect({ to: '/sign-in' })
  },
  component: ExpensesList,
})

function ExpensesList() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('All')
  const [sortField, setSortField] = useState<'date' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [revealed, setRevealed] = useState(false)

  const pillRef = useRef<HTMLSpanElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => { requestAnimationFrame(() => setRevealed(true)) }, [])

  const { data: expenseData, isLoading } = useExpenses({ pageSize: 100 })
  const { data: categories = [] } = useCategories()

  const allExpenses = expenseData?.items ?? []

  // Build category name map
  const catMap = new Map(categories.map(c => [c.id, c.name]))
  const categoryNames = ['All', ...categories.map(c => c.name)] as const

  const movePill = useCallback(() => {
    const idx = categoryNames.indexOf(categoryFilter as typeof categoryNames[number])
    const tab = tabRefs.current[idx]
    const pill = pillRef.current
    if (!tab || !pill) return
    pill.style.width = `${tab.offsetWidth}px`
    pill.style.transform = `translateX(${tab.offsetLeft}px)`
  }, [categoryFilter])

  useEffect(() => { movePill() }, [movePill])

  const filtered = allExpenses
    .map(e => ({ ...e, categoryName: catMap.get(e.categoryId) ?? 'Other' }))
    .filter(e => categoryFilter === 'All' || e.categoryName === categoryFilter)
    .filter(e => e.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortField === 'date') return mul * (new Date(a.date).getTime() - new Date(b.date).getTime())
      return mul * (Number(a.amount) - Number(b.amount))
    })

  const toggleSort = (field: 'date' | 'amount') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: 'date' | 'amount' }) => (
    <svg className={`inline-block ml-1 transition-transform duration-150 ${sortField === field ? 'opacity-100' : 'opacity-0'}`}
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ transform: sortField === field && sortDir === 'asc' ? 'rotate(180deg)' : undefined }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-24 bg-cream rounded-lg animate-pulse" />
            <div className="h-4 w-36 bg-cream/60 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(12px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)' }}>
      <div className="flex items-center justify-between vt-scroll-reveal" style={{ viewTransitionName: 'page-header' }}>
        <div className="t-stagger" ref={el => { if (el) requestAnimationFrame(() => el.classList.add('is-shown')) }}>
          <h1 className="text-xl font-semibold text-text-primary t-stagger-line">Expenses</h1>
          <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">{filtered.length} expenses</p>
        </div>
        <Link
          to="/expenses/new"
          data-cuelume-hover="tick"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 shadow-warm-sm hover:shadow-warm-md"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Expense
        </Link>
      </div>

      <div className="vt-scroll-reveal">
        <div className="relative max-w-md mb-4">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-all duration-200 shadow-warm-sm"
          />
        </div>

        <div className="t-tabs">
          <span ref={pillRef} className="t-tabs-pill" />
          {categoryNames.map((cat, i) => (
            <button
              key={cat}
              ref={el => { tabRefs.current[i] = el }}
              onClick={() => setCategoryFilter(cat)}
              aria-selected={categoryFilter === cat}
              className="t-tab"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[16px] shadow-warm-sm border border-border-light overflow-hidden vt-scroll-reveal-delay-1" style={{ viewTransitionName: 'expenses-table', opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(8px)', transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s' }}>
        <table className="w-full">
          <thead>
            <tr className="bg-cream/60">
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">Description</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">Category</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary cursor-pointer select-none hover:text-coral transition-colors" onClick={() => toggleSort('date')}>
                Date <SortIcon field="date" />
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-semibold text-text-secondary cursor-pointer select-none hover:text-coral transition-colors" onClick={() => toggleSort('amount')}>
                Amount <SortIcon field="amount" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <svg className="mx-auto mb-3 text-text-tertiary opacity-40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  <p className="text-sm text-text-secondary font-medium">No expenses found</p>
                  <p className="text-xs text-text-tertiary mt-1">Try adjusting your search or filters</p>
                </td>
              </tr>
            ) : (
              filtered.map((expense, i) => (
                <tr
                  key={expense.id}
                  className="border-b border-border-light last:border-0 hover:bg-cream/40 transition-colors duration-150 group"
                  style={{ opacity: revealed ? 1 : 0, transform: revealed ? 'none' : 'translateY(4px)', transition: `all 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.3 + i * 0.04}s` }}
                >
                  <td className="px-6 py-4 text-sm font-medium text-text-primary group-hover:text-coral transition-colors duration-150">{expense.description}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-coral-light/60 text-coral">
                      {expense.categoryName}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary font-mono">{new Date(expense.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-mono font-semibold text-text-primary text-right">
                    ${Number(expense.amount).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
