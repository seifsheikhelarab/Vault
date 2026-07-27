import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
    useGroup,
    useMembers,
    useBalances,
    useSettlements,
    useCreateSettlement,
    useExpenses,
    useCategories
} from '../lib/hooks';
import { useSession } from '../lib/auth-client';
import { authClient } from '../lib/auth-client';
import { Button } from '../components/shared';

export const Route = createFileRoute('/groups/$groupId')({
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
    },
    component: GroupDetail
});

function GroupDetail() {
    const { groupId } = Route.useParams();
    const { data: session } = useSession();
    const currentUserId = session?.user?.id;

    const [revealed, setRevealed] = useState(false);
    const [settling, setSettling] = useState<{
        from: string;
        to: string;
        amount: number;
    } | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settleNote, setSettleNote] = useState('');

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const { data: group, isLoading: groupLoading } = useGroup(groupId);
    const { data: members = [], isLoading: membersLoading } =
        useMembers(groupId);
    const { data: balances, isLoading: balancesLoading } = useBalances(groupId);
    const { data: settlements = [] } = useSettlements(groupId);
    const { data: groupExpensesData } = useExpenses({ groupId, pageSize: 50 });
    const groupExpenses = groupExpensesData?.items ?? [];
    const { data: categories = [] } = useCategories();
    const createSettlement = useCreateSettlement();

    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const memberMap = new Map(members.map((m) => [m.userId, m]));

    const handleSettle = () => {
        if (!settling) return;
        createSettlement.mutate(
            {
                toUserId: settling.to,
                amount: parseFloat(settleAmount) || settling.amount,
                groupId,
                note: settleNote || undefined
            },
            {
                onSuccess: () => {
                    setSettling(null);
                    setSettleAmount('');
                    setSettleNote('');
                }
            }
        );
    };

    if (groupLoading || membersLoading || balancesLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="h-7 w-40 bg-cream rounded-lg animate-pulse" />
                    <div className="h-4 w-56 bg-cream/60 rounded-lg animate-pulse" />
                </div>
                <div className="h-40 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />
                <div className="h-40 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="text-center py-20">
                <p className="text-text-secondary">Group not found</p>
                <Link
                    to="/groups"
                    data-cuelume-press
                    className="text-coral text-sm font-medium mt-2 inline-block"
                >
                    Back to Groups
                </Link>
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
            {/* Header */}
            <div>
                <Link
                    to="/groups"
                    data-cuelume-press
                    className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-coral transition-colors mb-3"
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
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Groups
                </Link>
                <h1 className="text-xl font-semibold text-text-primary">
                    {group.name}
                </h1>
                <p className="text-sm text-text-secondary mt-1 capitalize">
                    {group.kind} group · {members.length}{' '}
                    {members.length === 1 ? 'member' : 'members'} ·{' '}
                    {groupExpenses.length} expense
                    {groupExpenses.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Balances / Who Owes Whom */}
            <div className="border-b border-border-light pb-6">
                <h2 className="text-sm font-semibold text-text-primary mb-4">
                    Balances
                </h2>
                {balances && balances.debts.length > 0 ? (
                    <div className="space-y-3">
                        {balances.debts.map((debt, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between py-2 px-4 bg-cream/40 rounded-[10px]"
                            >
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-medium text-text-primary">
                                        {debt.from === currentUserId
                                            ? 'You'
                                            : debt.from.slice(0, 8)}
                                    </span>
                                    <span className="text-text-tertiary">
                                        owes
                                    </span>
                                    <span className="font-medium text-text-primary">
                                        {debt.to === currentUserId
                                            ? 'You'
                                            : debt.to.slice(0, 8)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-semibold text-sm text-text-primary">
                                        ${debt.amount.toFixed(2)}
                                    </span>
                                    {debt.from === currentUserId && (
                                        <button
                                            onClick={() => {
                                                setSettling(debt);
                                                setSettleAmount(
                                                    String(debt.amount)
                                                );
                                            }}
                                            data-cuelume-press
                                            className="text-xs font-medium text-coral hover:text-coral-dark transition-colors px-3 py-1 rounded-full border border-coral-light hover:bg-coral-light/30"
                                        >
                                            Settle
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-text-tertiary">All settled up</p>
                )}
            </div>

            {/* Settle modal */}
            {settling && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setSettling(null)}
                >
                    <div
                        className="bg-surface rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-text-primary mb-4">
                            Settle Up
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    value={settleAmount}
                                    onChange={(e) =>
                                        setSettleAmount(e.target.value)
                                    }
                                    step="0.01"
                                    min="0"
                                    className="w-full px-4 py-2.5 border-b border-border text-sm text-text-primary focus:outline-none focus:border-coral transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Note (optional)
                                </label>
                                <input
                                    type="text"
                                    value={settleNote}
                                    onChange={(e) =>
                                        setSettleNote(e.target.value)
                                    }
                                    placeholder="e.g. Venmo sent"
                                    className="w-full px-4 py-2.5 border-b border-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-coral transition-colors"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setSettling(null)}
                                    data-cuelume-press
                                    className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <Button
                                    onClick={handleSettle}
                                    disabled={
                                        !settleAmount ||
                                        createSettlement.isPending
                                    }
                                    className="flex-1"
                                >
                                    {createSettlement.isPending
                                        ? 'Settling...'
                                        : 'Confirm'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Expenses */}
            {groupExpenses.length > 0 && (
                <div className="border-b border-border-light pb-6">
                    <h2 className="text-sm font-semibold text-text-primary mb-4">
                        Expenses
                    </h2>
                    <div className="space-y-2">
                        {groupExpenses.map((expense, i) => (
                            <div
                                key={expense.id}
                                className="flex items-center justify-between py-3 px-4 rounded-[10px] hover:bg-cream/40 transition-colors"
                                style={{
                                    opacity: revealed ? 1 : 0,
                                    transition: `opacity 0.3s ease ${0.1 + i * 0.03}s`
                                }}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-[8px] bg-coral-light/60 flex items-center justify-center shrink-0">
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                        >
                                            <line
                                                x1="12"
                                                y1="1"
                                                x2="12"
                                                y2="23"
                                            />
                                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-text-primary truncate">
                                            {expense.description}
                                        </p>
                                        <p className="text-xs text-text-tertiary mt-0.5">
                                            {catNameMap.get(
                                                expense.categoryId
                                            ) ?? 'Other'}{' '}
                                            ·{' '}
                                            {new Date(
                                                expense.date
                                            ).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <span className="font-mono text-sm font-semibold text-text-primary shrink-0 ml-3">
                                    ${Number(expense.amount).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Members */}
            <div className="border-b border-border-light pb-6">
                <h2 className="text-sm font-semibold text-text-primary mb-4">
                    Members
                </h2>
                <div className="space-y-1">
                    {members.map((m) => (
                        <div
                            key={m.id}
                            className="flex items-center justify-between py-3 px-4 rounded-[10px] hover:bg-cream/40 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-coral-light/60 flex items-center justify-center text-xs font-semibold text-coral">
                                    {m.userId === currentUserId
                                        ? 'You'
                                        : m.userId.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-text-primary">
                                        {m.userId === currentUserId
                                            ? 'You'
                                            : m.userId.slice(0, 12)}
                                    </span>
                                    {m.role === 'admin' && (
                                        <span className="ml-2 text-xs font-semibold text-coral bg-coral-light/50 px-2 py-0.5 rounded-full">
                                            admin
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Settlements */}
            {settlements.length > 0 && (
                <div className="pb-6">
                    <h2 className="text-sm font-semibold text-text-primary mb-4">
                        Recent Settlements
                    </h2>
                    <div className="space-y-2">
                        {settlements.slice(0, 10).map((s) => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between py-2 px-4 text-sm"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-text-primary">
                                        {s.fromUserId === currentUserId
                                            ? 'You'
                                            : s.fromUserId.slice(0, 8)}
                                    </span>
                                    <span className="text-text-tertiary">
                                        paid
                                    </span>
                                    <span className="font-medium text-text-primary">
                                        {s.toUserId === currentUserId
                                            ? 'You'
                                            : s.toUserId.slice(0, 8)}
                                    </span>
                                </div>
                                <span className="font-mono font-semibold text-text-primary">
                                    ${Number(s.amount).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
