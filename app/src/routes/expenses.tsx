import {
    createFileRoute,
    Link,
    redirect,
    useNavigate
} from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useExpenses, useCategories, useDeleteExpense } from '../lib/hooks';
import { authClient } from '../lib/auth-client';
import { Button, IconButton } from '../components/shared';
import { AddExpenseDialog } from '../components/add-expense-dialog';
import type { Expense } from '@expense/shared';

type ExpenseSearch = {
    q: string;
    cat: string;
    sort: 'date' | 'amount';
    dir: 'asc' | 'desc';
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
};

export const DEFAULT_EXPENSE_SEARCH = {
    q: '',
    cat: 'All',
    sort: 'date' as const,
    dir: 'desc' as const,
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
};

const expenseSearchValidator = {
    parse: (input: Record<string, unknown>): ExpenseSearch => ({
        q: typeof input.q === 'string' ? input.q : DEFAULT_EXPENSE_SEARCH.q,
        cat:
            typeof input.cat === 'string'
                ? input.cat
                : DEFAULT_EXPENSE_SEARCH.cat,
        sort:
            input.sort === 'amount'
                ? ('amount' as const)
                : DEFAULT_EXPENSE_SEARCH.sort,
        dir: input.dir === 'asc' ? ('asc' as const) : DEFAULT_EXPENSE_SEARCH.dir,
        dateFrom:
            typeof input.dateFrom === 'string'
                ? input.dateFrom
                : DEFAULT_EXPENSE_SEARCH.dateFrom,
        dateTo:
            typeof input.dateTo === 'string'
                ? input.dateTo
                : DEFAULT_EXPENSE_SEARCH.dateTo,
        amountMin:
            typeof input.amountMin === 'string'
                ? input.amountMin
                : DEFAULT_EXPENSE_SEARCH.amountMin,
        amountMax:
            typeof input.amountMax === 'string'
                ? input.amountMax
                : DEFAULT_EXPENSE_SEARCH.amountMax
    })
};

export const Route = createFileRoute('/expenses')({
    validateSearch: expenseSearchValidator,
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
    },
    component: ExpensesList
});

function ExpensesList() {
    const { q, cat, sort, dir, dateFrom, dateTo, amountMin, amountMax } =
        Route.useSearch();
    const navigate = useNavigate({ from: Route.id });
    const [revealed, setRevealed] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const deleteExpense = useDeleteExpense();

    const pillRef = useRef<HTMLSpanElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const setFilter = useCallback(
        (updates: Record<string, string>) => {
            navigate({
                search: (prev: ExpenseSearch) => ({ ...prev, ...updates }),
                replace: true
            });
        },
        [navigate]
    );

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const { data: expenseData, isLoading } = useExpenses({ pageSize: 100 });
    const { data: categories = [] } = useCategories();

    const allExpenses = expenseData?.items ?? [];

    // Build category name map
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const categoryNames = ['All', ...categories.map((c) => c.name)] as const;

    const movePill = useCallback(() => {
        const idx = categoryNames.indexOf(
            cat as (typeof categoryNames)[number]
        );
        const tab = tabRefs.current[idx];
        const pill = pillRef.current;
        if (!tab || !pill) return;
        pill.style.width = `${tab.offsetWidth}px`;
        pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    }, [cat, categoryNames]);

    useEffect(() => {
        movePill();
    }, [movePill]);

    const filtered = allExpenses
        .map((e) => ({
            ...e,
            categoryName: catMap.get(e.categoryId) ?? 'Other'
        }))
        .filter((e) => cat === 'All' || e.categoryName === cat)
        .filter((e) =>
            e.description.toLowerCase().includes(q.toLowerCase())
        )
        .filter((e) => {
            if (!dateFrom && !dateTo) return true;
            const ed = new Date(e.date).getTime();
            if (dateFrom && ed < new Date(dateFrom).getTime()) return false;
            if (dateTo) {
                const end = new Date(dateTo);
                end.setDate(end.getDate() + 1);
                if (ed >= end.getTime()) return false;
            }
            return true;
        })
        .filter((e) => {
            const amt = Number(e.amount);
            if (amountMin && amt < parseFloat(amountMin)) return false;
            if (amountMax && amt > parseFloat(amountMax)) return false;
            return true;
        })
        .sort((a, b) => {
            const mul = dir === 'asc' ? 1 : -1;
            if (sort === 'date')
                return (
                    mul *
                    (new Date(a.date).getTime() - new Date(b.date).getTime())
                );
            return mul * (Number(a.amount) - Number(b.amount));
        });

    const toggleSort = (field: 'date' | 'amount') => {
        if (sort === field) {
            setFilter({ dir: dir === 'asc' ? 'desc' : 'asc' });
        } else {
            setFilter({ sort: field, dir: 'desc' });
        }
    };

    const SortIcon = ({ field }: { field: 'date' | 'amount' }) => (
        <svg
            className={`inline-block ml-1 transition-transform duration-150 ${sort === field ? 'opacity-100' : 'opacity-0'}`}
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
                transform:
                    sort === field && dir === 'asc'
                        ? 'rotate(180deg)'
                        : undefined
            }}
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    );

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
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="h-16 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className="space-y-6"
            style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'none' : 'translateY(12px)',
                transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
        >
            <div
                className="flex items-center justify-between"
                style={{ viewTransitionName: 'page-header' }}
            >
                <div
                    className="t-stagger"
                    ref={(el) => {
                        if (el)
                            requestAnimationFrame(() =>
                                el.classList.add('is-shown')
                            );
                    }}
                >
                    <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                        Expenses
                    </h1>
                    <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                        {filtered.length} expenses
                    </p>
                </div>
                <Button
                    onClick={() => setShowAddDialog(true)}
                    icon={
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    }
                >
                    Add Expense
                </Button>
            </div>

            <div>
                <div className="relative max-w-md mb-4">
                    <svg
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search expenses..."
                        value={q}
                        onChange={(e) => setFilter({ q: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 shadow-warm-sm"
                    />
                </div>

                {/* Date and Amount Filters */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-tertiary">
                            From
                        </span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) =>
                                setFilter({ dateFrom: e.target.value })
                            }
                            className="px-2.5 py-1.5 bg-surface border border-border rounded-[8px] text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-tertiary">
                            To
                        </span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) =>
                                setFilter({ dateTo: e.target.value })
                            }
                            className="px-2.5 py-1.5 bg-surface border border-border rounded-[8px] text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-tertiary">
                            $
                        </span>
                        <input
                            type="number"
                            placeholder="Min"
                            value={amountMin}
                            onChange={(e) =>
                                setFilter({ amountMin: e.target.value })
                            }
                            className="w-20 px-2.5 py-1.5 bg-surface border border-border rounded-[8px] text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-tertiary">
                            —
                        </span>
                        <input
                            type="number"
                            placeholder="Max"
                            value={amountMax}
                            onChange={(e) =>
                                setFilter({ amountMax: e.target.value })
                            }
                            className="w-20 px-2.5 py-1.5 bg-surface border border-border rounded-[8px] text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>
                    {(dateFrom || dateTo || amountMin || amountMax) && (
                        <button
                            onClick={() =>
                                setFilter({
                                    dateFrom: '',
                                    dateTo: '',
                                    amountMin: '',
                                    amountMax: ''
                                })
                            }
                            className="text-xs font-medium text-coral hover:text-coral-dark transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                <div className="t-tabs">
                    <span ref={pillRef} className="t-tabs-pill" />
                    {categoryNames.map((name, i) => (
                        <button
                            key={name}
                            ref={(el) => {
                                tabRefs.current[i] = el;
                            }}
                            onClick={() => setFilter({ cat: name })}
                            aria-selected={cat === name}
                            data-cuelume-toggle
                            className="t-tab"
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            <div
                style={{
                    viewTransitionName: 'expenses-table',
                    opacity: revealed ? 1 : 0,
                    transform: revealed ? 'none' : 'translateY(8px)',
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s'
                }}
            >
                <table className="w-full">
                    <thead>
                        <tr className="bg-cream/60">
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">
                                Description
                            </th>
                            <th className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary">
                                Category
                            </th>
                            <th
                                className="px-6 py-3.5 text-left text-xs font-semibold text-text-secondary cursor-pointer select-none hover:text-coral transition-colors"
                                onClick={() => toggleSort('date')}
                            >
                                Date <SortIcon field="date" />
                            </th>
                            <th
                                className="px-6 py-3.5 text-right text-xs font-semibold text-text-secondary cursor-pointer select-none hover:text-coral transition-colors"
                                onClick={() => toggleSort('amount')}
                            >
                                Amount <SortIcon field="amount" />
                            </th>
                            <th className="px-6 py-3.5 w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={4}
                                    className="px-6 py-16 text-center"
                                >
                                    <svg
                                        className="mx-auto mb-3 text-text-tertiary opacity-40"
                                        width="40"
                                        height="40"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    >
                                        <circle cx="11" cy="11" r="8" />
                                        <line
                                            x1="21"
                                            y1="21"
                                            x2="16.65"
                                            y2="16.65"
                                        />
                                        <line x1="8" y1="11" x2="14" y2="11" />
                                    </svg>
                                    <p className="text-sm text-text-secondary font-medium">
                                        No expenses found
                                    </p>
                                    <p className="text-xs text-text-tertiary mt-1">
                                        Try adjusting your search or filters
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((expense, i) => (
                                <tr
                                    key={expense.id}
                                    className="border-b border-border-light last:border-0 hover:bg-cream/40 transition-colors duration-150 group"
                                    style={{
                                        opacity: revealed ? 1 : 0,
                                        transform: revealed
                                            ? 'none'
                                            : 'translateY(4px)',
                                        transition: `all 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.3 + i * 0.04}s`
                                    }}
                                >
                                    <td className="px-6 py-4 text-sm font-medium text-text-primary group-hover:text-coral transition-colors duration-150">
                                        <div className="flex items-center gap-2">
                                            <span>{expense.description}</span>
                                            {expense.receiptUrl && (
                                                <a
                                                    href={expense.receiptUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className="text-text-tertiary hover:text-coral transition-colors shrink-0"
                                                    title="View receipt"
                                                >
                                                    <svg
                                                        width="14"
                                                        height="14"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    >
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                        <polyline points="14 2 14 8 20 8" />
                                                        <line
                                                            x1="16"
                                                            y1="13"
                                                            x2="8"
                                                            y2="13"
                                                        />
                                                        <line
                                                            x1="16"
                                                            y1="17"
                                                            x2="8"
                                                            y2="17"
                                                        />
                                                    </svg>
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-coral-light/60 text-coral">
                                            {expense.categoryName}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {new Date(
                                            expense.date
                                        ).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono font-semibold text-text-primary text-right whitespace-nowrap">
                                        ${Number(expense.amount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <IconButton
                                                onClick={() =>
                                                    setEditingExpense(expense)
                                                }
                                                ariaLabel="Edit expense"
                                                className="opacity-0 group-hover:opacity-100"
                                            >
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </IconButton>
                                            <IconButton
                                                onClick={() =>
                                                    setDeleteConfirm(
                                                        expense.id
                                                    )
                                                }
                                                ariaLabel="Delete expense"
                                                className="opacity-0 group-hover:opacity-100"
                                            >
                                                <svg
                                                    width="14"
                                                    height="14"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                >
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </IconButton>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setDeleteConfirm(null)}
                >
                    <div
                        className="bg-surface rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4 mx-auto">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#FF3B30"
                                strokeWidth="2"
                                strokeLinecap="round"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h3 className="text-base font-semibold text-text-primary text-center mb-2">
                            Delete Expense?
                        </h3>
                        <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">
                            This will permanently delete this expense. This
                            action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteExpense.mutate(deleteConfirm, {
                                        onSuccess: () => setDeleteConfirm(null)
                                    });
                                }}
                                disabled={deleteExpense.isPending}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                            >
                                {deleteExpense.isPending
                                    ? 'Deleting...'
                                    : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Expense Dialog */}
            <AddExpenseDialog
                key={editingExpense?.id ?? 'create'}
                open={showAddDialog || !!editingExpense}
                onClose={() => {
                    setShowAddDialog(false);
                    setEditingExpense(null);
                }}
                expense={editingExpense}
            />
        </div>
    );
}
