import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useSession } from '../lib/auth-client';
import {
    useCategories,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory,
    useBudgets,
    useCreateBudget,
    useUpdateBudget,
    useDeleteBudget,
    useExpenses,
    useGroups
} from '../lib/hooks';
import { authClient } from '../lib/auth-client';
import { useTheme } from '../lib/use-theme';
import { Button, IconButton } from '../components/shared';

export const Route = createFileRoute('/settings')({
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
    },
    component: Settings
});

function Settings() {
    const [revealed, setRevealed] = useState(false);

    // Budget creation form state
    const [showBudgetForm, setShowBudgetForm] = useState(false);
    const [budgetCategoryId, setBudgetCategoryId] = useState('');
    const [budgetAmount, setBudgetAmount] = useState('');
    const [budgetPeriod, setBudgetPeriod] = useState<
        'monthly' | 'weekly' | 'yearly'
    >('monthly');
    const [budgetDepartmentId, setBudgetDepartmentId] = useState('');
    const [budgetErrors, setBudgetErrors] = useState<Record<string, string>>(
        {}
    );

    const { theme, toggle: toggleTheme } = useTheme();

    // Category CRUD state
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [deletingCategory, setDeletingCategory] = useState<string | null>(
        null
    );

    // Delete account state
    const [showDeleteAccount, setShowDeleteAccount] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const { data: session } = useSession();
    const { data: categories = [] } = useCategories();
    const { data: budgets = [], isLoading: budgetsLoading } = useBudgets();
    const { data: groups = [] } = useGroups();
    const { data: expenseData } = useExpenses({ pageSize: 200 });
    const expenses = expenseData?.items ?? [];

    const createCategory = useCreateCategory();
    const updateCategory = useUpdateCategory();
    const deleteCategory = useDeleteCategory();

    const createBudget = useCreateBudget();
    const updateBudget = useUpdateBudget();
    const deleteBudget = useDeleteBudget();

    // Budget inline edit state
    const [editingBudget, setEditingBudget] = useState<string | null>(null);
    const [editBudgetAmount, setEditBudgetAmount] = useState('');
    const [editBudgetPeriod, setEditBudgetPeriod] = useState<
        'monthly' | 'weekly' | 'yearly'
    >('monthly');

    const user = session?.user;

    // Compute spent per category
    const spentMap = new Map<string, number>();
    expenses.forEach((e) => {
        spentMap.set(
            e.categoryId,
            (spentMap.get(e.categoryId) ?? 0) + e.amountCents / 100
        );
    });

    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const departments = groups.filter((g) => g.kind === 'department');
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    // Categories that don't already have a budget for the selected scope
    const categoriesWithoutBudget = categories.filter(
        (c) =>
            !budgets.some(
                (b) =>
                    b.categoryId === c.id &&
                    (b.groupId || null) === (budgetDepartmentId || null)
            )
    );

    const handleCreateBudget = (e: React.FormEvent) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (!budgetCategoryId) errs.category = 'Select a category';
        if (!budgetAmount || parseFloat(budgetAmount) <= 0)
            errs.amount = 'Enter a valid amount';
        setBudgetErrors(errs);
        if (Object.keys(errs).length > 0) return;

        createBudget.mutate(
            {
                categoryId: budgetCategoryId,
                amountCents: Math.round(parseFloat(budgetAmount) * 100),
                period: budgetPeriod,
                groupId: budgetDepartmentId || undefined
            },
            {
                onSuccess: () => {
                    setShowBudgetForm(false);
                    setBudgetCategoryId('');
                    setBudgetAmount('');
                    setBudgetPeriod('monthly');
                    setBudgetDepartmentId('');
                    setBudgetErrors({});
                }
            }
        );
    };

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
                className="t-stagger"
                ref={(el) => {
                    if (el)
                        requestAnimationFrame(() =>
                            el.classList.add('is-shown')
                        );
                }}
            >
                <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                    Settings
                </h1>
                <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                    Manage your preferences
                </p>
            </div>

            {/* Categories */}
            <div
                className="border-b border-border-light pb-6"
                style={{
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s'
                }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-text-primary mb-1">
                            Categories
                        </h2>
                        <p className="text-sm text-text-secondary">
                            Manage your custom expense categories.
                        </p>
                    </div>
                    <Button
                        onClick={() => {
                            setShowCategoryForm(true);
                            setNewCategoryName('');
                        }}
                        size="sm"
                        icon={
                            <svg
                                width="14"
                                height="14"
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
                        Add Category
                    </Button>
                </div>

                {/* New category form */}
                {showCategoryForm && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!newCategoryName.trim()) return;
                            createCategory.mutate(
                                { name: newCategoryName.trim() },
                                {
                                    onSuccess: () => {
                                        setShowCategoryForm(false);
                                        setNewCategoryName('');
                                    }
                                }
                            );
                        }}
                        className="mb-4 flex items-center gap-2 p-3 bg-warm-white rounded-[10px] border border-border-light"
                    >
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Category name"
                            autoFocus
                            className="flex-1 px-3 py-2 bg-[var(--color-surface)] border border-border rounded-[8px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                        <button
                            type="submit"
                            disabled={
                                !newCategoryName.trim() ||
                                createCategory.isPending
                            }
                            className="px-3 py-2 bg-coral text-white text-sm font-medium rounded-[8px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-150 disabled:opacity-50 shrink-0"
                            data-cuelume-press
                        >
                            {createCategory.isPending ? 'Adding...' : 'Add'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCategoryForm(false);
                                setNewCategoryName('');
                            }}
                            className="p-2 text-text-tertiary hover:text-text-primary transition-colors shrink-0"
                            data-cuelume-press
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
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </form>
                )}

                {/* Category list */}
                {categories.length === 0 ? (
                    <p className="text-sm text-text-tertiary">
                        No categories yet. Add one above.
                    </p>
                ) : (
                    <div className="space-y-1">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between py-2.5 px-3 rounded-[8px] hover:bg-cream/40 transition-colors group"
                            >
                                {editingCategory === cat.id ? (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!editCategoryName.trim())
                                                return;
                                            updateCategory.mutate(
                                                {
                                                    id: cat.id,
                                                    name: editCategoryName.trim()
                                                },
                                                {
                                                    onSuccess: () =>
                                                        setEditingCategory(null)
                                                }
                                            );
                                        }}
                                        className="flex items-center gap-2 flex-1"
                                    >
                                        <input
                                            type="text"
                                            value={editCategoryName}
                                            onChange={(e) =>
                                                setEditCategoryName(
                                                    e.target.value
                                                )
                                            }
                                            autoFocus
                                            className="flex-1 px-2 py-1 bg-[var(--color-surface)] border border-border rounded-[6px] text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral"
                                        />
                                        <button
                                            type="submit"
                                            disabled={
                                                !editCategoryName.trim() ||
                                                updateCategory.isPending
                                            }
                                            className="text-xs font-medium text-coral hover:text-coral-dark transition-colors shrink-0"
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setEditingCategory(null)
                                            }
                                            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
                                        >
                                            Cancel
                                        </button>
                                    </form>
                                ) : (
                                    <>
                                        <span className="text-sm font-medium text-text-primary">
                                            {cat.name}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <IconButton
                                                onClick={() => {
                                                    setEditingCategory(cat.id);
                                                    setEditCategoryName(
                                                        cat.name
                                                    );
                                                }}
                                                ariaLabel="Rename category"
                                            >
                                                <svg
                                                    width="13"
                                                    height="13"
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
                                                    setDeletingCategory(cat.id)
                                                }
                                                ariaLabel="Delete category"
                                            >
                                                <svg
                                                    width="13"
                                                    height="13"
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
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Delete category confirmation */}
            {deletingCategory && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setDeletingCategory(null)}
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
                            Delete Category?
                        </h3>
                        <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">
                            Expenses in this category will be unlinked but kept.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeletingCategory(null)}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteCategory.mutate(deletingCategory, {
                                        onSettled: () =>
                                            setDeletingCategory(null)
                                    });
                                }}
                                disabled={deleteCategory.isPending}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                            >
                                {deleteCategory.isPending
                                    ? 'Deleting...'
                                    : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Budgets */}
            <div
                className="border-b border-border-light pb-6"
                style={{
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.2s'
                }}
            >
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-base font-semibold text-text-primary mb-1">
                            Budgets
                        </h2>
                        <p className="text-sm text-text-secondary">
                            Spending limits for each category.
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowBudgetForm(true)}
                        size="sm"
                        icon={
                            <svg
                                width="14"
                                height="14"
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
                        New Budget
                    </Button>
                </div>

                {/* Budget creation form */}
                {showBudgetForm && (
                    <form
                        onSubmit={handleCreateBudget}
                        className="mb-6 p-5 bg-warm-white rounded-[12px] border border-border-light space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-text-primary">
                                Create Budget
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBudgetForm(false);
                                    setBudgetErrors({});
                                }}
                                className="text-text-tertiary hover:text-text-primary transition-colors"
                                data-cuelume-press
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Category
                                </label>
                                <select
                                    value={budgetCategoryId}
                                    onChange={(e) =>
                                        setBudgetCategoryId(e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-border rounded-[8px] text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                >
                                    <option value="">Select...</option>
                                    {categoriesWithoutBudget.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                    {categoriesWithoutBudget.length === 0 &&
                                        categories.length > 0 && (
                                            <option value="" disabled>
                                                All categories have budgets
                                            </option>
                                        )}
                                </select>
                                {budgetErrors.category && (
                                    <p className="text-xs text-error mt-1">
                                        {budgetErrors.category}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Amount ($)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={budgetAmount}
                                    onChange={(e) =>
                                        setBudgetAmount(e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-border rounded-[8px] text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                />
                                {budgetErrors.amount && (
                                    <p className="text-xs text-error mt-1">
                                        {budgetErrors.amount}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Period
                                </label>
                                <div className="flex gap-1.5 p-1 bg-cream/60 dark:bg-white/[0.06] rounded-[8px]">
                                    {(
                                        ['monthly', 'weekly', 'yearly'] as const
                                    ).map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setBudgetPeriod(p)}
                                            data-cuelume-toggle
                                            className={`flex-1 py-1.5 px-2 rounded-[6px] text-xs font-medium transition-colors duration-150 ${
                                                budgetPeriod === p
                                                    ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                                    : 'text-text-tertiary hover:text-text-secondary'
                                            }`}
                                        >
                                            {p === 'monthly'
                                                ? 'Monthly'
                                                : p === 'weekly'
                                                  ? 'Weekly'
                                                  : 'Yearly'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                    Department (optional)
                                </label>
                                <select
                                    value={budgetDepartmentId}
                                    onChange={(e) =>
                                        setBudgetDepartmentId(e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-border rounded-[8px] text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                >
                                    <option value="">Personal (default)</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBudgetForm(false);
                                    setBudgetErrors({});
                                }}
                                className="px-4 py-2 rounded-[8px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                                data-cuelume-press
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createBudget.isPending}
                                className="flex-1 px-4 py-2 bg-coral text-white text-sm font-medium rounded-[8px] hover:bg-coral-dark active:scale-[0.98] transition-colors transition-transform duration-150 disabled:opacity-50"
                                data-cuelume-press
                            >
                                {createBudget.isPending
                                    ? 'Creating...'
                                    : 'Create Budget'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Budget list */}
                {budgetsLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="h-4 w-48 bg-cream rounded animate-pulse" />
                                <div className="h-2 bg-cream rounded-full animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : budgets.length === 0 ? (
                    <div className="text-center py-10">
                        <svg
                            className="mx-auto mb-3 text-text-tertiary opacity-40"
                            width="36"
                            height="36"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        >
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        </svg>
                        <p className="text-sm text-text-secondary font-medium">
                            No budgets set
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                            Create one to track category spending.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {budgets.map((budget) => {
                            const catName =
                                catMap.get(budget.categoryId) ?? 'Other';
                            const deptName = budget.groupId
                                ? deptMap.get(budget.groupId)
                                : null;
                            const spent = spentMap.get(budget.categoryId) ?? 0;
                            const budgetAmt = budget.amountCents / 100;
                            const pct =
                                budgetAmt > 0
                                    ? Math.min((spent / budgetAmt) * 100, 100)
                                    : 0;
                            const over90 = pct > 90;
                            const isEditing = editingBudget === budget.id;

                            return (
                                <div key={budget.id} className="group">
                                    {isEditing ? (
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                const newAmt =
                                                    parseFloat(
                                                        editBudgetAmount
                                                    );
                                                if (
                                                    !editBudgetAmount ||
                                                    newAmt <= 0
                                                )
                                                    return;
                                                updateBudget.mutate(
                                                    {
                                                        id: budget.id,
                                                        amountCents: Math.round(
                                                            newAmt * 100
                                                        ),
                                                        period: editBudgetPeriod
                                                    },
                                                    {
                                                        onSuccess: () =>
                                                            setEditingBudget(
                                                                null
                                                            )
                                                    }
                                                );
                                            }}
                                            className="flex items-center gap-3 text-sm mb-1.5"
                                        >
                                            <span className="font-medium text-text-primary shrink-0">
                                                {catName}
                                            </span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={editBudgetAmount}
                                                onChange={(e) =>
                                                    setEditBudgetAmount(
                                                        e.target.value
                                                    )
                                                }
                                                autoFocus
                                                className="w-20 px-2 py-1 bg-[var(--color-surface)] border border-border rounded-[6px] text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral"
                                            />
                                            <div className="flex gap-1 p-0.5 bg-cream/60 dark:bg-white/[0.06] rounded-[6px]">
                                                {(
                                                    [
                                                        'monthly',
                                                        'weekly',
                                                        'yearly'
                                                    ] as const
                                                ).map((p) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() =>
                                                            setEditBudgetPeriod(
                                                                p
                                                            )
                                                        }
                                                        data-cuelume-toggle
                                                        className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium transition-colors duration-150 ${
                                                            editBudgetPeriod ===
                                                            p
                                                                ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                                                : 'text-text-tertiary hover:text-text-secondary'
                                                        }`}
                                                    >
                                                        {p === 'monthly'
                                                            ? 'mo'
                                                            : p === 'weekly'
                                                              ? 'wk'
                                                              : 'yr'}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={
                                                    updateBudget.isPending
                                                }
                                                className="text-xs font-medium text-coral hover:text-coral-dark transition-colors shrink-0"
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditingBudget(null)
                                                }
                                                className="text-xs text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
                                            >
                                                Cancel
                                            </button>
                                        </form>
                                    ) : (
                                        <div className="flex items-center justify-between text-sm mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-text-primary">
                                                    {catName}
                                                </span>
                                                {deptName && (
                                                    <span className="text-[10px] font-medium text-text-tertiary bg-cream px-1.5 py-0.5 rounded-full">
                                                        {deptName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-text-secondary text-xs">
                                                    <span className="font-mono">
                                                        ${spent.toFixed(0)}
                                                    </span>{' '}
                                                    /{' '}
                                                    <span className="font-mono">
                                                        $
                                                        {budgetAmt.toLocaleString()}
                                                    </span>{' '}
                                                    (
                                                    {budget.period === 'monthly'
                                                        ? 'mo'
                                                        : budget.period ===
                                                            'weekly'
                                                          ? 'wk'
                                                          : 'yr'}
                                                    )
                                                </span>
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <IconButton
                                                        onClick={() => {
                                                            setEditingBudget(
                                                                budget.id
                                                            );
                                                            setEditBudgetAmount(
                                                                String(
                                                                    budgetAmt
                                                                )
                                                            );
                                                            setEditBudgetPeriod(
                                                                budget.period as
                                                                    | 'monthly'
                                                                    | 'weekly'
                                                                    | 'yearly'
                                                            );
                                                        }}
                                                        ariaLabel="Edit budget"
                                                    >
                                                        <svg
                                                            width="13"
                                                            height="13"
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
                                                            deleteBudget.mutate(
                                                                budget.id
                                                            )
                                                        }
                                                        disabled={
                                                            deleteBudget.isPending
                                                        }
                                                        ariaLabel="Delete budget"
                                                    >
                                                        <svg
                                                            width="13"
                                                            height="13"
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
                                            </div>
                                        </div>
                                    )}
                                    <div className="h-2.5 bg-cream rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700 ease-out"
                                            style={{
                                                width: `${pct}%`,
                                                background: over90
                                                    ? 'linear-gradient(90deg, var(--color-warning), var(--color-error))'
                                                    : 'linear-gradient(90deg, var(--color-coral), var(--color-chart-2))'
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Appearance */}
            <div
                className="border-b border-border-light pb-6"
                style={{
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s'
                }}
            >
                <h2 className="text-base font-semibold text-text-primary mb-4">
                    Appearance
                </h2>
                <div className="flex items-center justify-between py-3 border-b border-border-light">
                    <div>
                        <p className="text-sm font-medium text-text-primary">
                            Dark Mode
                        </p>
                        <p className="text-xs text-text-tertiary mt-0.5">
                            Switch between light and dark themes
                        </p>
                    </div>
                    <button
                        onClick={toggleTheme}
                        data-cuelume-toggle
                        className={`relative w-12 h-6 rounded-full transition-colors duration-150 ${
                            theme === 'dark' ? 'bg-coral' : 'bg-border'
                        }`}
                    >
                        <div
                            className={`absolute top-0.5 left-0 w-5 h-5 rounded-full bg-surface shadow-warm-sm transition-transform duration-150 flex items-center justify-center ${
                                theme === 'dark'
                                    ? 'translate-x-[22px]'
                                    : 'translate-x-0.5'
                            }`}
                        >
                            {theme === 'dark' ? (
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    className="text-coral"
                                >
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                                </svg>
                            ) : (
                                <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    className="text-warning"
                                >
                                    <circle cx="12" cy="12" r="5" />
                                    <line x1="12" y1="1" x2="12" y2="3" />
                                    <line x1="12" y1="21" x2="12" y2="23" />
                                    <line
                                        x1="4.22"
                                        y1="4.22"
                                        x2="5.64"
                                        y2="5.64"
                                    />
                                    <line
                                        x1="18.36"
                                        y1="18.36"
                                        x2="19.78"
                                        y2="19.78"
                                    />
                                    <line x1="1" y1="12" x2="3" y2="12" />
                                    <line x1="21" y1="12" x2="23" y2="12" />
                                    <line
                                        x1="4.22"
                                        y1="19.78"
                                        x2="5.64"
                                        y2="18.36"
                                    />
                                    <line
                                        x1="18.36"
                                        y1="5.64"
                                        x2="19.78"
                                        y2="4.22"
                                    />
                                </svg>
                            )}
                        </div>
                    </button>
                </div>
                <div className="flex items-center justify-between py-3">
                    <div>
                        <p className="text-sm font-medium text-text-primary">
                            Current theme
                        </p>
                        <p className="text-xs text-text-tertiary mt-0.5 capitalize">
                            {theme}
                        </p>
                    </div>
                </div>
            </div>

            {/* Account */}
            <div
                style={{
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s'
                }}
            >
                <h2 className="text-base font-semibold text-text-primary mb-4">
                    Account
                </h2>
                <div className="space-y-0">
                    <div className="flex items-center justify-between py-4 border-b border-border-light">
                        <div>
                            <p className="text-sm font-medium text-text-primary">
                                Name
                            </p>
                            <p className="text-xs text-text-tertiary mt-0.5">
                                {user?.name ?? '—'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between py-4 border-b border-border-light last:border-0">
                        <div>
                            <p className="text-sm font-medium text-text-primary">
                                Email
                            </p>
                            <p className="text-xs text-text-tertiary mt-0.5">
                                {user?.email ?? '—'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border-light">
                    <button
                        onClick={() => setShowDeleteAccount(true)}
                        className="px-4 py-2 text-sm font-medium text-error border border-error/20 rounded-[10px] hover:bg-error/5 active:scale-[0.98] transition-all duration-150"
                        data-cuelume-press
                    >
                        Delete Account
                    </button>
                    <p className="text-xs text-text-tertiary mt-2">
                        Permanently delete your account and all associated data.
                        This cannot be undone.
                    </p>
                </div>
            </div>

            {/* Delete Account Confirmation */}
            {showDeleteAccount && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() =>
                        !deletingAccount && setShowDeleteAccount(false)
                    }
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
                            Delete Account?
                        </h3>
                        <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">
                            This will permanently delete your account, all
                            expenses, groups, and data. This action cannot be
                            undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteAccount(false)}
                                disabled={deletingAccount}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setDeletingAccount(true);
                                    const { error } =
                                        await authClient.deleteUser();
                                    if (error) {
                                        setDeletingAccount(false);
                                        return;
                                    }
                                    window.location.href = '/';
                                }}
                                disabled={deletingAccount}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                            >
                                {deletingAccount
                                    ? 'Deleting...'
                                    : 'Delete Forever'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
