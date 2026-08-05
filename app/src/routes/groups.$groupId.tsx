import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
    useGroup,
    useMembers,
    useBalances,
    useSettlements,
    useCreateSettlement,
    useExpenses,
    useCategories,
    useAddMember,
    useRemoveMember,
    useUpdateMember,
    useUpdateGroup,
    useUserSearch
} from '../lib/hooks';
import { useSession } from '../lib/auth-client';
import { authClient } from '../lib/auth-client';
import { Button, IconButton } from '../components/shared';

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

    // Settle modal state
    const [settling, setSettling] = useState<{
        from: string;
        to: string;
        amount: number;
    } | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settleNote, setSettleNote] = useState('');

    // Add member state
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin'>(
        'member'
    );
    const [addMemberError, setAddMemberError] = useState<string | null>(null);
    const [emailFocused, setEmailFocused] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);

    const { data: userSuggestions = [] } = useUserSearch(
        emailFocused ? newMemberEmail : ''
    );

    // Group rename state
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    useEffect(() => {
        requestAnimationFrame(() => setRevealed(true));
    }, []);

    const { data: group, isLoading: groupLoading } = useGroup(groupId);
    const { data: members = [], isLoading: membersLoading } =
        useMembers(groupId);
    const { data: balances, isLoading: balancesLoading } = useBalances(groupId);
    // Compute suggested settle: pay the person you owe the most
    const suggestedSettle =
        balances && currentUserId
            ? (() => {
                  const myBal = balances.find(
                      (b: { userId: string; balanceCents: number }) =>
                          b.userId === currentUserId
                  );
                  if (!myBal || myBal.balanceCents >= 0) return null;
                  // Find who to pay: someone with a positive balance (creditor)
                  const creditor = balances.find(
                      (b: { userId: string; balanceCents: number }) =>
                          b.balanceCents > 0
                  );
                  if (!creditor) return null;
                  return {
                      from: currentUserId,
                      to: creditor.userId,
                      amount: Math.min(
                          Math.abs(myBal.balanceCents),
                          creditor.balanceCents
                      )
                  };
              })()
            : null;
    const { data: settlements = [] } = useSettlements(groupId);
    const { data: groupExpensesData } = useExpenses({ groupId, pageSize: 50 });
    const groupExpenses = groupExpensesData?.items ?? [];
    const { data: categories = [] } = useCategories();

    const createSettlement = useCreateSettlement();
    const addMember = useAddMember();
    const removeMember = useRemoveMember();
    const updateMember = useUpdateMember();
    const updateGroup = useUpdateGroup();
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup blur timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        };
    }, []);

    const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
    const userNameMap = new Map(
        members.map((m) => [m.userId, m.user?.name ?? m.userId.slice(0, 12)])
    );
    const currentMembership = members.find((m) => m.userId === currentUserId);
    const isAdmin = currentMembership?.role === 'admin';

    const handleSettle = () => {
        if (!settling) return;
        createSettlement.mutate(
            {
                toUserId: settling.to,
                amountCents: Math.round(
                    (parseFloat(settleAmount) || settling.amount / 100) * 100
                ),
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

    const handleAddMember = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberEmail.trim()) return;
        setAddMemberError(null);
        addMember.mutate(
            { groupId, email: newMemberEmail.trim(), role: newMemberRole },
            {
                onSuccess: () => {
                    setShowAddMember(false);
                    setNewMemberEmail('');
                    setNewMemberRole('member');
                },
                onError: (err: Error) => {
                    setAddMemberError(err.message);
                }
            }
        );
    };

    const handleRename = (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameValue.trim() || renameValue.trim() === group?.name) {
            setRenaming(false);
            return;
        }
        updateGroup.mutate(
            { id: groupId, name: renameValue.trim() },
            { onSuccess: () => setRenaming(false) }
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
                {renaming ? (
                    <form
                        onSubmit={handleRename}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') setRenaming(false);
                            }}
                            className="text-xl font-semibold text-text-primary bg-transparent border-b-2 border-coral outline-none px-1"
                        />
                        <button
                            type="submit"
                            className="text-xs font-medium text-coral hover:text-coral-dark"
                        >
                            Save
                        </button>
                    </form>
                ) : (
                    <h1
                        className={`text-xl font-semibold text-text-primary ${isAdmin ? 'cursor-pointer hover:text-coral transition-colors' : ''}`}
                        onClick={() => {
                            if (isAdmin) {
                                setRenameValue(group.name);
                                setRenaming(true);
                            }
                        }}
                        title={isAdmin ? 'Click to rename' : undefined}
                    >
                        {group.name}
                    </h1>
                )}
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
                {balances && balances.length > 0 ? (
                    <div className="space-y-2">
                        {balances.map((b) => (
                            <div
                                key={b.userId}
                                className="flex items-center justify-between py-2 px-4 bg-cream/40 rounded-[10px]"
                            >
                                <span className="text-sm font-medium text-text-primary">
                                    {b.userId === currentUserId
                                        ? 'You'
                                        : (b.userName ?? b.userId.slice(0, 8))}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`font-mono font-semibold text-sm ${b.balanceCents >= 0 ? 'text-success' : 'text-coral'}`}
                                    >
                                        {b.balanceCents >= 0 ? '+' : '-'}$
                                        {(
                                            Math.abs(b.balanceCents) / 100
                                        ).toFixed(2)}
                                    </span>
                                    {suggestedSettle &&
                                        b.userId === suggestedSettle.from &&
                                        b.balanceCents < 0 && (
                                            <button
                                                onClick={() => {
                                                    setSettling(
                                                        suggestedSettle
                                                    );
                                                    setSettleAmount(
                                                        String(
                                                            suggestedSettle.amount /
                                                                100
                                                        )
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
                                    ${(expense.amountCents / 100).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Members */}
            <div className="border-b border-border-light pb-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-text-primary">
                        Members
                    </h2>
                    {isAdmin && (
                        <Button
                            onClick={() => {
                                setShowAddMember(true);
                                setAddMemberError(null);
                            }}
                            size="sm"
                            variant="ghost"
                            icon={
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                >
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <line x1="19" y1="8" x2="19" y2="14" />
                                    <line x1="22" y1="11" x2="16" y2="11" />
                                </svg>
                            }
                        >
                            Add
                        </Button>
                    )}
                </div>

                {/* Add member modal */}
                {showAddMember && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                        onClick={() => setShowAddMember(false)}
                    >
                        <form
                            onSubmit={handleAddMember}
                            className="bg-surface rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-base font-semibold text-text-primary mb-4">
                                Add Member
                            </h3>
                            {addMemberError && (
                                <div className="mb-4 p-2.5 rounded-[8px] bg-error/10 border border-error/20 text-xs text-error font-medium">
                                    {addMemberError}
                                </div>
                            )}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="email"
                                            value={newMemberEmail}
                                            onChange={(e) =>
                                                setNewMemberEmail(
                                                    e.target.value
                                                )
                                            }
                                            onFocus={() => {
                                                setEmailFocused(true);
                                                setHighlightIdx(-1);
                                            }}
                                            onBlur={() => {
                                                blurTimeoutRef.current =
                                                    setTimeout(
                                                        () =>
                                                            setEmailFocused(
                                                                false
                                                            ),
                                                        150
                                                    );
                                            }}
                                            onKeyDown={(e) => {
                                                if (!userSuggestions.length)
                                                    return;
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightIdx((i) =>
                                                        i <
                                                        userSuggestions.length -
                                                            1
                                                            ? i + 1
                                                            : 0
                                                    );
                                                } else if (
                                                    e.key === 'ArrowUp'
                                                ) {
                                                    e.preventDefault();
                                                    setHighlightIdx((i) =>
                                                        i > 0
                                                            ? i - 1
                                                            : userSuggestions.length -
                                                              1
                                                    );
                                                } else if (
                                                    e.key === 'Enter' &&
                                                    highlightIdx >= 0
                                                ) {
                                                    e.preventDefault();
                                                    setNewMemberEmail(
                                                        userSuggestions[
                                                            highlightIdx
                                                        ].email
                                                    );
                                                    setEmailFocused(false);
                                                } else if (e.key === 'Escape') {
                                                    setEmailFocused(false);
                                                }
                                            }}
                                            placeholder="friend@example.com"
                                            autoFocus
                                            className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                        />
                                        {userSuggestions.length > 0 &&
                                            emailFocused && (
                                                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-[10px] shadow-warm-lg overflow-hidden z-10">
                                                    {userSuggestions.map(
                                                        (u, idx) => (
                                                            <button
                                                                key={u.id}
                                                                type="button"
                                                                data-cuelume-press
                                                                onMouseDown={(
                                                                    e
                                                                ) => {
                                                                    e.preventDefault();
                                                                    setNewMemberEmail(
                                                                        u.email
                                                                    );
                                                                    setEmailFocused(
                                                                        false
                                                                    );
                                                                }}
                                                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                                    idx ===
                                                                    highlightIdx
                                                                        ? 'bg-coral-light/50'
                                                                        : 'hover:bg-cream/50'
                                                                }`}
                                                            >
                                                                <div className="w-7 h-7 rounded-full bg-coral-light/60 flex items-center justify-center text-xs font-semibold text-coral shrink-0">
                                                                    {u.name?.[0]?.toUpperCase() ??
                                                                        u.email[0].toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-text-primary truncate">
                                                                        {u.name}
                                                                    </p>
                                                                    <p className="text-xs text-text-tertiary truncate">
                                                                        {
                                                                            u.email
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Role
                                    </label>
                                    <div className="flex gap-1.5 p-1 bg-cream/60 dark:bg-white/[0.06] rounded-[8px]">
                                        {(['member', 'admin'] as const).map(
                                            (r) => (
                                                <button
                                                    key={r}
                                                    type="button"
                                                    onClick={() =>
                                                        setNewMemberRole(r)
                                                    }
                                                    data-cuelume-toggle
                                                    className={`flex-1 py-1.5 px-3 rounded-[6px] text-xs font-medium transition-colors duration-150 capitalize ${
                                                        newMemberRole === r
                                                            ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                                            : 'text-text-tertiary hover:text-text-secondary'
                                                    }`}
                                                >
                                                    {r}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddMember(false)}
                                        data-cuelume-press
                                        className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            !newMemberEmail.trim() ||
                                            addMember.isPending
                                        }
                                        data-cuelume-press
                                        className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                                    >
                                        {addMember.isPending
                                            ? 'Adding...'
                                            : 'Add Member'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-1">
                    {members.map((m) => {
                        const isSelf = m.userId === currentUserId;
                        return (
                            <div
                                key={m.id}
                                className="flex items-center justify-between py-3 px-4 rounded-[10px] hover:bg-cream/40 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-coral-light/60 flex items-center justify-center text-xs font-semibold text-coral">
                                        {isSelf
                                            ? 'You'
                                            : (
                                                  m.user?.name?.[0] ??
                                                  m.userId.slice(0, 2)
                                              ).toUpperCase()}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-text-primary">
                                            {isSelf
                                                ? 'You'
                                                : (m.user?.name ??
                                                  m.userId.slice(0, 12))}
                                        </span>
                                        {m.role === 'admin' && (
                                            <span className="text-xs font-semibold text-coral bg-coral-light/50 px-2 py-0.5 rounded-full">
                                                admin
                                            </span>
                                        )}
                                        {m.role === 'member' && (
                                            <span className="text-xs font-semibold text-text-tertiary bg-cream px-2 py-0.5 rounded-full">
                                                member
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Admin actions (not on self) */}
                                {isAdmin && !isSelf && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <IconButton
                                            onClick={() =>
                                                updateMember.mutate({
                                                    id: m.id,
                                                    role:
                                                        m.role === 'admin'
                                                            ? 'member'
                                                            : 'admin'
                                                })
                                            }
                                            ariaLabel={`Change ${m.role} to ${m.role === 'admin' ? 'member' : 'admin'}`}
                                            disabled={updateMember.isPending}
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
                                                <polyline points="16 3 21 8 8 21 3 21 3 16 16 3" />
                                            </svg>
                                        </IconButton>
                                        <IconButton
                                            onClick={() =>
                                                removeMember.mutate(m.id)
                                            }
                                            ariaLabel="Remove member"
                                            disabled={removeMember.isPending}
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
                                                <line
                                                    x1="18"
                                                    y1="6"
                                                    x2="6"
                                                    y2="18"
                                                />
                                                <line
                                                    x1="6"
                                                    y1="6"
                                                    x2="18"
                                                    y2="18"
                                                />
                                            </svg>
                                        </IconButton>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                                            : (userNameMap.get(s.fromUserId) ??
                                              s.fromUserId.slice(0, 8))}
                                    </span>
                                    <span className="text-text-tertiary">
                                        paid
                                    </span>
                                    <span className="font-medium text-text-primary">
                                        {s.toUserId === currentUserId
                                            ? 'You'
                                            : (userNameMap.get(s.toUserId) ??
                                              s.toUserId.slice(0, 8))}
                                    </span>
                                </div>
                                <span className="font-mono font-semibold text-text-primary">
                                    ${(s.amountCents / 100).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
