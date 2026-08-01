import {
    createFileRoute,
    Link,
    useNavigate,
    redirect
} from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    useCreateExpense,
    useCreateClaim,
    useCreateSplits,
    useCategories,
    useGroups,
    useMembers
} from '../lib/hooks';
import { DEFAULT_EXPENSE_SEARCH } from './expenses';
import { useSession } from '../lib/auth-client';
import { authClient } from '../lib/auth-client';
import { ReceiptUpload } from '../components/receipt-upload';
import { Button } from '../components/shared';

export const Route = createFileRoute('/expenses/new')({
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
    },
    component: NewExpense
});

type SplitType = 'even' | 'percentage' | 'exact';

function NewExpense() {
    const navigate = useNavigate();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [scope, setScope] = useState<'personal' | 'group' | 'company'>(
        'personal'
    );
    const [groupId, setGroupId] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [submitAsClaim, setSubmitAsClaim] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState<string | undefined>();
    const [splitType, setSplitType] = useState<SplitType>('even');
    const [memberShares, setMemberShares] = useState<Record<string, string>>(
        {}
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [shakeField, setShakeField] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successIsClaim, setSuccessIsClaim] = useState(false);
    const [successIsGroup, setSuccessIsGroup] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [revealed, setRevealed] = useState(false);

    const createExpense = useCreateExpense();
    const createClaim = useCreateClaim();
    const createSplits = useCreateSplits();
    const { data: categories = [] } = useCategories();
    const { data: groups = [] } = useGroups();
    const { data: session } = useSession();
    const currentUserId = session?.user?.id;

    // Social groups for splitting
    const socialGroups = useMemo(
        () => groups.filter((g) => g.kind === 'social'),
        [groups]
    );
    // Department groups for company scope
    const departments = useMemo(
        () => groups.filter((g) => g.kind === 'department'),
        [groups]
    );

    // Fetch members when a group is selected
    const { data: members = [] } = useMembers(scope === 'group' ? groupId : '');

    // The effective members list for splitting (all group members)
    const splitMembers = useMemo(
        () => members.filter((m) => m.role === 'member' || m.role === 'admin'),
        [members]
    );

    const totalAmount = parseFloat(amount) || 0;
    const memberCount = splitMembers.length;

    // Recalculate shares when split type, amount, or members change
    useEffect(() => {
        if (memberCount === 0 || !totalAmount) {
            setMemberShares({});
            return;
        }

        if (splitType === 'even') {
            const share = Math.floor((totalAmount / memberCount) * 100) / 100;
            const remainder =
                Math.round((totalAmount - share * memberCount) * 100) / 100;
            const shares: Record<string, string> = {};
            splitMembers.forEach((m, i) => {
                shares[m.userId] = (
                    i === 0 ? share + remainder : share
                ).toFixed(2);
            });
            setMemberShares(shares);
        }
        // For percentage and exact, don't auto-recalculate (user controls inputs)
    }, [splitType, totalAmount, memberCount, scope, groupId]);

    // Compute share for a single member based on split type
    const computeShare = useCallback(
        (userId: string): number => {
            if (!totalAmount || memberCount === 0) return 0;
            if (splitType === 'even')
                return parseFloat(memberShares[userId] ?? '0') || 0;
            if (splitType === 'percentage') {
                const pct = parseFloat(memberShares[userId] ?? '0') || 0;
                return Math.round(((totalAmount * pct) / 100) * 100) / 100;
            }
            // exact
            return parseFloat(memberShares[userId] ?? '0') || 0;
        },
        [totalAmount, memberCount, splitType, memberShares]
    );

    // Compute the running total of all shares (for validation display)
    const computedTotal = useMemo(() => {
        if (splitType === 'percentage') {
            const totalPct = splitMembers.reduce(
                (sum, m) =>
                    sum + (parseFloat(memberShares[m.userId] ?? '0') || 0),
                0
            );
            return { value: totalPct, unit: '%' as const };
        }
        const total = splitMembers.reduce(
            (sum, m) => sum + computeShare(m.userId),
            0
        );
        return { value: total, unit: '$' as const };
    }, [splitMembers, memberShares, splitType, computeShare]);

    const shareSumMatches =
        splitType === 'percentage'
            ? Math.abs(computedTotal.value - 100) < 0.5
            : Math.abs(computedTotal.value - totalAmount) < 0.01;

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const triggerShake = useCallback((field: string) => {
        setShakeField(field);
        setTimeout(() => setShakeField(null), 300);
    }, []);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!amount || parseFloat(amount) <= 0)
            errs.amount = 'Enter a valid amount';
        if (!description.trim()) errs.description = 'Description is required';
        if (!categoryId) errs.category = 'Select a category';
        if (!date) errs.date = 'Date is required';
        if (scope === 'group') {
            if (!groupId) errs.group = 'Select a group';
            if (memberCount === 0) errs.group = 'No members in this group';
            if (!shareSumMatches && totalAmount > 0) {
                errs.splits =
                    splitType === 'percentage'
                        ? `Shares total ${computedTotal.value.toFixed(1)}% — must be 100%`
                        : `Shares total $${computedTotal.value.toFixed(2)} — must equal $${totalAmount.toFixed(2)}`;
            }
        }
        if (scope === 'company' && !departmentId)
            errs.department = 'Select a department';
        setErrors(errs);
        Object.keys(errs).forEach(triggerShake);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            // Step 1: Create the expense
            const expense = await createExpense.mutateAsync({
                amount: totalAmount,
                description: description.trim(),
                categoryId,
                date: new Date(date).toISOString(),
                scope,
                groupId:
                    scope === 'group' ? groupId : departmentId || undefined,
                receiptUrl: receiptUrl || undefined
            });

            // Step 2: If group scope, create splits
            if (scope === 'group' && expense?.id && memberCount > 0) {
                const splits = splitMembers.map((m) => ({
                    userId: m.userId,
                    amount: computeShare(m.userId)
                }));
                await createSplits.mutateAsync({
                    expenseId: expense.id,
                    splits
                });
            }

            // Step 3: If company scope + opted to claim, create the claim
            let isClaim = false;
            if (scope === 'company' && submitAsClaim && expense?.id) {
                await createClaim.mutateAsync({ expenseId: expense.id });
                isClaim = true;
            }

            setSuccessIsClaim(isClaim);
            setSuccessIsGroup(scope === 'group');
            setShowSuccess(true);
            setTimeout(
                () =>
                    navigate({
                        to: '/expenses',
                        search: DEFAULT_EXPENSE_SEARCH
                    }),
                1400
            );
        } catch (err: unknown) {
            setErrors({ submit: err instanceof Error ? err.message : 'Failed to create expense' });
            setSubmitting(false);
        }
    };

    const fieldClass = (field: string) => {
        const base =
            'w-full px-4 py-3 bg-surface border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 shadow-warm-sm';
        const border = errors[field] ? 'border-error' : 'border-border';
        const shake = shakeField === field ? 'is-shaking' : 't-input';
        return `${base} ${border} ${shake}`;
    };

    const handleShareChange = (userId: string, value: string) => {
        setMemberShares((prev) => ({ ...prev, [userId]: value }));
    };

    // Reset group-specific state when scope changes
    useEffect(() => {
        if (scope !== 'group') {
            setGroupId('');
            setMemberShares({});
        }
        if (scope !== 'company') {
            setDepartmentId('');
            setSubmitAsClaim(false);
        }
    }, [scope]);

    // Reset memberShares when switching groups (percentage/exact shares don't transfer)
    useEffect(() => {
        setMemberShares({});
    }, [groupId]);

    const isPending = submitting || createExpense.isPending;

    return (
        <div
            className="max-w-2xl mx-auto"
            style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'none' : 'translateY(12px)',
                transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
        >
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-warm-white/80 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="t-success-check" data-state="in">
                            <svg
                                width="80"
                                height="80"
                                viewBox="0 0 80 80"
                                fill="none"
                            >
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="38"
                                    stroke={
                                        successIsClaim ? '#FFB340' : '#34C759'
                                    }
                                    strokeWidth="3"
                                    fill="none"
                                />
                                <path
                                    d="M24 40 L35 51 L56 30"
                                    stroke={
                                        successIsClaim ? '#FFB340' : '#34C759'
                                    }
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            </svg>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-text-primary">
                            {successIsClaim
                                ? 'Claim submitted!'
                                : successIsGroup
                                  ? 'Expense split!'
                                  : 'Expense added!'}
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                            {successIsClaim
                                ? 'Waiting for approval'
                                : successIsGroup
                                  ? 'Balances updated'
                                  : 'Saved to your records'}
                        </p>
                    </div>
                </div>
            )}

            <div
                className="mb-8 t-stagger"
                ref={(el) => {
                    if (el)
                        requestAnimationFrame(() =>
                            el.classList.add('is-shown')
                        );
                }}
                style={{ viewTransitionName: 'page-header' }}
            >
                <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                    Add Expense
                </h1>
                <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                    Record a new expense
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-surface rounded-[16px] p-6 shadow-warm-sm border border-border-light space-y-6"
                style={{
                    transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s'
                }}
            >
                {errors.submit && (
                    <div className="p-3 rounded-[10px] bg-error/10 border border-error/20 text-sm text-error font-medium">
                        {errors.submit}
                    </div>
                )}
                {/* Scope Toggle */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Type
                    </label>
                    <div className="flex gap-2 p-1 bg-cream/60 dark:bg-white/[0.06] rounded-[10px]">
                        {(['personal', 'group', 'company'] as const).map(
                            (opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setScope(opt)}
                                    data-cuelume-toggle
                                    className={`flex-1 py-2.5 px-4 rounded-[8px] text-sm font-medium transition-colors duration-150 ${
                                        scope === opt
                                            ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                            : 'text-text-tertiary hover:text-text-secondary'
                                    }`}
                                >
                                    {opt === 'personal'
                                        ? 'Personal'
                                        : opt === 'group'
                                          ? 'Group'
                                          : 'Company'}
                                </button>
                            )
                        )}
                    </div>
                </div>
                {/* Group Picker (group scope) */}
                {scope === 'group' && (
                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-2">
                            Group
                            {groupId && memberCount > 0 && (
                                <span className="ml-2 text-xs font-normal text-text-tertiary">
                                    · {memberCount} member
                                    {memberCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </label>
                        {socialGroups.length === 0 ? (
                            <div className="p-4 rounded-[10px] bg-cream/40 text-sm text-text-tertiary text-center">
                                No groups yet.{' '}
                                <Link
                                    to="/groups/new"
                                    className="text-coral font-medium hover:underline"
                                >
                                    Create one
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {socialGroups.map((g) => {
                                    const isActive = groupId === g.id;
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => setGroupId(g.id)}
                                            data-cuelume-press
                                            className={`flex items-center gap-2.5 p-3 rounded-[10px] border-2 transition-colors duration-150 ${
                                                isActive
                                                    ? 'border-coral bg-coral-light/50 text-coral shadow-warm-glow'
                                                    : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                                            }`}
                                        >
                                            <div className="w-8 h-8 rounded-[8px] bg-coral-light/60 flex items-center justify-center shrink-0">
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle
                                                        cx="9"
                                                        cy="7"
                                                        r="4"
                                                    />
                                                </svg>
                                            </div>
                                            <div className="text-left min-w-0">
                                                <span className="text-xs font-semibold truncate block">
                                                    {g.name}
                                                </span>
                                                <span className="text-[10px] text-text-tertiary capitalize">
                                                    {g.kind}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {errors.group && (
                            <p className="t-error-msg text-xs text-error mt-1.5">
                                {errors.group}
                            </p>
                        )}
                    </div>
                )}
                {/* Department Picker (company scope) */}{' '}
                {scope === 'company' && (
                    <div>
                        <label className="block text-sm font-semibold text-text-primary mb-2">
                            Department
                        </label>
                        {departments.length === 0 ? (
                            <div className="p-4 rounded-[10px] bg-cream/40 text-sm text-text-tertiary text-center">
                                {' '}
                                No departments available.{' '}
                                <Link
                                    to="/groups/new"
                                    className="text-coral font-medium hover:underline"
                                >
                                    Create one
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {departments.map((dept) => (
                                    <button
                                        key={dept.id}
                                        type="button"
                                        onClick={() => setDepartmentId(dept.id)}
                                        data-cuelume-press
                                        className={`flex items-center gap-2 p-3 rounded-[10px] border-2 transition-colors duration-150 ${
                                            departmentId === dept.id
                                                ? 'border-coral bg-coral-light/50 text-coral shadow-warm-glow'
                                                : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                                        }`}
                                    >
                                        <div className="w-7 h-7 rounded-[8px] bg-coral-light/60 flex items-center justify-center shrink-0">
                                            <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                            >
                                                <rect
                                                    x="2"
                                                    y="7"
                                                    width="20"
                                                    height="14"
                                                    rx="2"
                                                    ry="2"
                                                />
                                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                            </svg>
                                        </div>
                                        <span className="text-xs font-semibold truncate">
                                            {dept.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {errors.department && (
                            <p className="t-error-msg text-xs text-error mt-1.5">
                                {errors.department}
                            </p>
                        )}
                    </div>
                )}
                {/* Submit as Claim toggle (company scope) */}
                {scope === 'company' && departmentId && (
                    <label className="flex items-start gap-3 p-4 rounded-[10px] bg-warm-white border border-border-light cursor-pointer hover:bg-cream/50 transition-colors duration-150 group">
                        <div className="relative mt-0.5">
                            <input
                                type="checkbox"
                                checked={submitAsClaim}
                                onChange={(e) =>
                                    setSubmitAsClaim(e.target.checked)
                                }
                                className="sr-only"
                            />
                            <div
                                className={`w-5 h-5 rounded-[6px] border-2 transition-colors duration-150 flex items-center justify-center ${
                                    submitAsClaim
                                        ? 'bg-coral border-coral'
                                        : 'border-border group-hover:border-coral-light'
                                }`}
                            >
                                {submitAsClaim && (
                                    <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-text-primary">
                                Submit as claim
                            </span>
                            <p className="text-xs text-text-tertiary mt-0.5">
                                Request reimbursement from the department
                                budget. An admin will review and approve.
                            </p>
                        </div>
                    </label>
                )}
                {/* Amount (before splits so split values are meaningful) */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Amount
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-mono text-sm">
                            $
                        </span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full pl-8 pr-4 py-3 bg-surface border border-border rounded-[10px] text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 shadow-warm-sm"
                        />
                    </div>
                    {errors.amount && (
                        <p className="t-error-msg text-xs text-error mt-1.5">
                            {errors.amount}
                        </p>
                    )}
                </div>
                {/* Split UI (group scope) — placed after Amount so users see meaningful split values */}
                {scope === 'group' &&
                    groupId &&
                    memberCount > 0 &&
                    totalAmount > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-text-primary mb-3">
                                Split
                            </label>

                            {/* Split Type Tabs */}
                            <div className="flex gap-1.5 p-1 bg-cream/60 dark:bg-white/[0.06] rounded-[8px] mb-4">
                                {[
                                    {
                                        value: 'even' as const,
                                        label: 'Even',
                                        desc: 'Equal shares'
                                    },
                                    {
                                        value: 'percentage' as const,
                                        label: 'By %',
                                        desc: 'Percentage split'
                                    },
                                    {
                                        value: 'exact' as const,
                                        label: 'Exact',
                                        desc: 'Enter amounts'
                                    }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        data-cuelume-toggle
                                        onClick={() => {
                                            setSplitType(opt.value);
                                            // Reset shares when switching split type
                                            if (
                                                opt.value === 'even' &&
                                                memberCount > 0 &&
                                                totalAmount > 0
                                            ) {
                                                const share =
                                                    Math.floor(
                                                        (totalAmount /
                                                            memberCount) *
                                                            100
                                                    ) / 100;
                                                const remainder =
                                                    Math.round(
                                                        (totalAmount -
                                                            share *
                                                                memberCount) *
                                                            100
                                                    ) / 100;
                                                const shares: Record<
                                                    string,
                                                    string
                                                > = {};
                                                splitMembers.forEach((m, i) => {
                                                    shares[m.userId] = (
                                                        i === 0
                                                            ? share + remainder
                                                            : share
                                                    ).toFixed(2);
                                                });
                                                setMemberShares(shares);
                                            } else if (
                                                opt.value === 'percentage' &&
                                                memberCount > 0
                                            ) {
                                                const equalPct =
                                                    Math.floor(
                                                        (100 / memberCount) *
                                                            100
                                                    ) / 100;
                                                const remPct =
                                                    Math.round(
                                                        (100 -
                                                            equalPct *
                                                                memberCount) *
                                                            100
                                                    ) / 100;
                                                const shares: Record<
                                                    string,
                                                    string
                                                > = {};
                                                splitMembers.forEach((m, i) => {
                                                    shares[m.userId] = (
                                                        i === 0
                                                            ? equalPct + remPct
                                                            : equalPct
                                                    ).toFixed(1);
                                                });
                                                setMemberShares(shares);
                                            } else {
                                                setMemberShares({});
                                            }
                                        }}
                                        className={`flex-1 py-2 px-2 rounded-[6px] text-xs font-medium transition-colors duration-150 ${
                                            splitType === opt.value
                                                ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                                : 'text-text-tertiary hover:text-text-secondary'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* Member Rows */}
                            <div className="space-y-2">
                                {splitMembers.map((m, _) => {
                                    const isYou = m.userId === currentUserId;
                                    const displayName = isYou
                                        ? 'You'
                                        : m.userId.slice(0, 8);
                                    const share = computeShare(m.userId);
                                    const isEmpty =
                                        !memberShares[m.userId] &&
                                        splitType !== 'even';

                                    return (
                                        <div
                                            key={m.id}
                                            className={`flex items-center gap-3 p-3 rounded-[10px] border transition-colors duration-150 ${
                                                isEmpty
                                                    ? 'border-border-light'
                                                    : 'border-border-light/60'
                                            } ${isYou ? 'bg-coral-light/20' : 'bg-transparent'} hover:border-coral-light`}
                                        >
                                            {/* Avatar */}
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                                                    isYou
                                                        ? 'bg-coral text-white'
                                                        : 'bg-cream text-text-secondary'
                                                }`}
                                            >
                                                {isYou
                                                    ? 'You'
                                                    : m.userId
                                                          .slice(0, 2)
                                                          .toUpperCase()}
                                            </div>

                                            {/* Name */}
                                            <div className="flex-1 min-w-0">
                                                <span
                                                    className={`text-sm font-medium ${isYou ? 'text-coral' : 'text-text-primary'}`}
                                                >
                                                    {displayName}
                                                </span>
                                                {m.role === 'admin' && (
                                                    <span className="ml-1.5 text-[10px] font-semibold text-text-tertiary bg-cream px-1.5 py-0.5 rounded-full">
                                                        admin
                                                    </span>
                                                )}
                                            </div>

                                            {/* Share Input */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {splitType === 'even' ? (
                                                    <span className="font-mono text-sm font-semibold text-text-primary tabular-nums min-w-[5rem] text-right">
                                                        ${share.toFixed(2)}
                                                    </span>
                                                ) : splitType ===
                                                  'percentage' ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            placeholder="0"
                                                            value={
                                                                memberShares[
                                                                    m.userId
                                                                ] ?? ''
                                                            }
                                                            onChange={(e) =>
                                                                handleShareChange(
                                                                    m.userId,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-20 px-2.5 py-1.5 text-right bg-surface border border-border rounded-[6px] text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                                        />
                                                        <span className="text-xs text-text-tertiary font-medium">
                                                            %
                                                        </span>
                                                        <span className="font-mono text-xs text-text-tertiary tabular-nums w-16 text-right">
                                                            ${share.toFixed(2)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-text-tertiary">
                                                            $
                                                        </span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={
                                                                memberShares[
                                                                    m.userId
                                                                ] ?? ''
                                                            }
                                                            onChange={(e) =>
                                                                handleShareChange(
                                                                    m.userId,
                                                                    e.target
                                                                        .value
                                                                )
                                                            }
                                                            className="w-24 px-2.5 py-1.5 text-right bg-surface border border-border rounded-[6px] text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Running Total */}
                            {totalAmount > 0 && (
                                <div
                                    className={`mt-3 flex items-center justify-between py-2 px-3 rounded-[8px] text-xs font-medium ${
                                        shareSumMatches
                                            ? 'bg-success/10 text-success'
                                            : 'bg-warning/10 text-warning'
                                    }`}
                                >
                                    <span>
                                        {splitType === 'percentage'
                                            ? 'Total %'
                                            : 'Total split'}
                                    </span>
                                    <span className="font-mono font-semibold">
                                        {splitType === 'percentage'
                                            ? `${computedTotal.value.toFixed(1)}%`
                                            : `$${computedTotal.value.toFixed(2)} / $${totalAmount.toFixed(2)}`}
                                        {shareSumMatches && ' ✓'}
                                    </span>
                                </div>
                            )}

                            {errors.splits && (
                                <p className="text-xs text-warning mt-1.5">
                                    {errors.splits}
                                </p>
                            )}
                        </div>
                    )}
                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Description
                    </label>
                    <div className="t-input-wrap">
                        <input
                            type="text"
                            placeholder="What was this expense for?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={fieldClass('description')}
                        />
                        {errors.description && (
                            <p className="t-error-msg text-xs text-error mt-1.5">
                                {errors.description}
                            </p>
                        )}
                    </div>
                </div>
                {/* Category */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Category
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {categories.map((cat) => (
                            <button
                                type="button"
                                key={cat.id}
                                onClick={() => setCategoryId(cat.id)}
                                data-cuelume-press
                                className={`flex flex-col items-center gap-1.5 p-3.5 rounded-[10px] border-2 transition-colors duration-150 ${
                                    categoryId === cat.id
                                        ? 'border-coral bg-coral-light/50 text-coral shadow-warm-glow'
                                        : 'border-border-light hover:border-coral-light hover:bg-cream/50 text-text-secondary'
                                }`}
                            >
                                <span className="text-xl">
                                    {cat.icon || (
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                    )}
                                </span>
                                <span className="text-xs font-semibold">
                                    {cat.name}
                                </span>
                            </button>
                        ))}
                    </div>
                    {errors.category && (
                        <p className="t-error-msg text-xs text-error mt-1.5">
                            {errors.category}
                        </p>
                    )}
                </div>
                {/* Date */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Date
                    </label>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className={fieldClass('date')}
                    />
                    {errors.date && (
                        <p className="t-error-msg text-xs text-error mt-1.5">
                            {errors.date}
                        </p>
                    )}
                </div>
                {/* Receipt Upload */}
                <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">
                        Receipt (optional)
                    </label>
                    <ReceiptUpload
                        value={receiptUrl}
                        onChange={setReceiptUrl}
                    />
                </div>
                {/* Submit Buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        type="button"
                        onClick={() =>
                            navigate({
                                to: '/expenses',
                                search: DEFAULT_EXPENSE_SEARCH
                            })
                        }
                        variant="secondary"
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isPending}
                        className="flex-1"
                    >
                        {isPending
                            ? scope === 'group'
                                ? 'Splitting...'
                                : submitAsClaim
                                  ? 'Submitting claim...'
                                  : 'Adding...'
                            : scope === 'group'
                              ? splitType === 'even'
                                  ? `Split Evenly ($${totalAmount.toFixed(2)})`
                                  : 'Split Expense'
                              : submitAsClaim
                                ? 'Submit Claim'
                                : 'Add Expense'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
