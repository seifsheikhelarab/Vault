import {
    createFileRoute,
    Link,
    Outlet,
    redirect,
    useLocation
} from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
    useCompanySummary,
    useClaims,
    useCreateGroup,
    useDeleteGroup,
    useOrganizations,
    useOrganizationMembers,
    useRemoveOrgMember,
    useUpdateMemberRole
} from '../lib/hooks';
import { authClient } from '../lib/auth-client';
import type { CompanySummary, ClaimWithExpense } from '../lib/api';
import { Button, IconButton, EmptyState } from '../components/shared';
import { CreateGroupDialog } from '../components/create-group-dialog';
import { InviteMemberDialog } from '../components/invite-member-dialog';
export const Route = createFileRoute('/company')({
    beforeLoad: async () => {
        const { data } = await authClient.getSession();
        if (!data?.user) throw redirect({ to: '/sign-in' });
    },
    component: CompanyDashboard
});

const STATUS_COLORS: Record<string, string> = {
    submitted: 'bg-warning/15 text-warning border-warning/20',
    approved: 'bg-success/15 text-success border-success/20',
    rejected: 'bg-error/15 text-error border-error/20',
    reimbursed: 'bg-info/15 text-info border-info/20'
};

function CompanyDashboard() {
    const [revealed, setRevealed] = useState(false);
    const staggerRef = useRef<HTMLDivElement>(null);
    const [showCreateDept, setShowCreateDept] = useState(false);
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
    const [newDeptName, setNewDeptName] = useState('');
    const [deletingDept, setDeletingDept] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [showInviteDialog, setShowInviteDialog] = useState<string | null>(
        null
    );
    const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

    useEffect(() => {
        requestAnimationFrame(() => {
            setRevealed(true);
            staggerRef.current?.classList.add('is-shown');
        });
    }, []);

    const { data: summary, isLoading: summaryLoading } = useCompanySummary();
    const { data: recentClaims = [], isLoading: claimsLoading } = useClaims({
        status: 'submitted'
    });
    const createGroup = useCreateGroup();
    const deleteGroup = useDeleteGroup();
    const { data: organizations = [] } = useOrganizations();
    const { data: orgMembers = [], isLoading: orgMembersLoading } =
        useOrganizationMembers(expandedOrg ?? undefined);
    const removeOrgMember = useRemoveOrgMember();
    const updateMemberRole = useUpdateMemberRole();

    const handleCreateDepartment = () => {
        if (!newDeptName.trim()) return;
        createGroup.mutate(
            { name: newDeptName.trim(), kind: 'department' },
            {
                onSuccess: () => {
                    setShowCreateDept(false);
                    setNewDeptName('');
                }
            }
        );
    };

    const handleDeleteDepartment = (id: string) => {
        setDeletingDept(id);
        deleteGroup.mutate(id, {
            onSettled: () => {
                setDeletingDept(null);
                setConfirmDelete(null);
            }
        });
    };

    const isLoading = summaryLoading || claimsLoading;

    const location = useLocation();
    const isChildActive = location.pathname !== '/company';

    if (isChildActive) {
        return <Outlet />;
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="h-7 w-32 bg-cream rounded-lg animate-pulse" />
                    <div className="h-4 w-48 bg-cream/60 rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-28 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light"
                        />
                    ))}
                </div>
                <div className="h-72 bg-surface rounded-[16px] animate-pulse shadow-warm-sm border border-border-light" />
            </div>
        );
    }

    const hasDepartments = summary && summary.departments.length > 0;
    const departments = hasDepartments ? summary!.departments : [];
    const totalBudget = hasDepartments ? summary!.totalBudget : 0;
    const totalSpent = hasDepartments ? summary!.totalSpent : 0;
    const pendingClaims = hasDepartments ? summary!.pendingClaims : 0;
    const remaining = totalBudget - totalSpent;

    const SUMMARY_CARDS = [
        { label: 'Total Budget', value: `$${totalBudget.toLocaleString()}` },
        { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
        { label: 'Remaining', value: `$${remaining.toLocaleString()}` },
        { label: 'Pending Claims', value: String(pendingClaims) }
    ];

    return (
        <>
            {!hasDepartments ? (
                /* ── Empty state ────────────────────────────── */
                <div
                    className="space-y-6"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? 'none' : 'translateY(12px)',
                        transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                    }}
                >
                    <div className="t-stagger" ref={staggerRef}>
                        <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                            Company
                        </h1>
                        <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                            Department budgets and expense claims
                        </p>
                    </div>
                    <div
                        style={{
                            opacity: revealed ? 1 : 0,
                            transition:
                                'all 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.15s'
                        }}
                    >
                        <EmptyState
                            icon={
                                <svg
                                    width="28"
                                    height="28"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-coral"
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
                            }
                            title="No departments set up"
                            description="Create a department group to manage budgets and expense claims for your team."
                        />
                        <div className="mt-4 flex justify-center">
                            <Button
                                onClick={() => setShowCreateGroupDialog(true)}
                            >
                                Create Department
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── Dashboard ──────────────────────────────── */
                <div
                    className="space-y-8"
                    style={{
                        opacity: revealed ? 1 : 0,
                        transform: revealed ? 'none' : 'translateY(12px)',
                        transition: 'all 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="t-stagger" ref={staggerRef}>
                            <h1 className="text-xl font-semibold text-text-primary t-stagger-line">
                                Company
                            </h1>
                            <p className="text-sm text-text-secondary mt-1 t-stagger-line t-stagger-line--2">
                                {departments.length} departments ·{' '}
                                {pendingClaims} pending claim
                                {pendingClaims !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button to="/company/claims" variant="secondary">
                                Claims Queue
                                {pendingClaims > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-coral text-white text-xs font-bold">
                                        {pendingClaims}
                                    </span>
                                )}
                            </Button>
                            <Button
                                onClick={() => setShowCreateDept(true)}
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
                                New Department
                            </Button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {SUMMARY_CARDS.map((card, i) => (
                            <div
                                key={card.label}
                                style={{
                                    opacity: revealed ? 1 : 0,
                                    transform: revealed
                                        ? 'translateY(0)'
                                        : 'translateY(12px)',
                                    transition: `all 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.1 + i * 0.06}s`
                                }}
                            >
                                <div className="text-xs font-medium text-text-tertiary mb-2">
                                    {card.label}
                                </div>
                                <div className="font-mono text-xl font-bold text-text-primary tracking-tight">
                                    {card.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Overall Budget Progress */}
                    <div
                        className="border-b border-border-light pb-6"
                        style={{
                            opacity: revealed ? 1 : 0,
                            transition:
                                'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.3s'
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-base font-semibold text-text-primary">
                                Overall Budget
                            </h2>
                            <span className="text-xs font-mono text-text-secondary">
                                ${totalSpent.toLocaleString()} / $
                                {totalBudget.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-3 bg-cream rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0}%`,
                                    background:
                                        'linear-gradient(90deg, #FF6B6B, #FFAB91)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Departments */}
                    <div
                        className="border-b border-border-light pb-6"
                        style={{
                            opacity: revealed ? 1 : 0,
                            transition:
                                'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.35s'
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-text-primary">
                                Departments
                            </h2>
                        </div>
                        <div className="space-y-4">
                            {departments.map(
                                (
                                    dept: CompanySummary['departments'][number],
                                    i: number
                                ) => (
                                    <div
                                        key={dept.id}
                                        className="p-4 rounded-[10px] hover:bg-cream/50 transition-colors duration-150 group"
                                        style={{
                                            opacity: revealed ? 1 : 0,
                                            transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.4 + i * 0.05}s`
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[10px] bg-coral-light/60 flex items-center justify-center">
                                                    <svg
                                                        width="18"
                                                        height="18"
                                                        viewBox="0 0 24 24"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        className="text-coral"
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
                                                <div>
                                                    <Link
                                                        to="/groups/$groupId"
                                                        params={{
                                                            groupId: dept.id
                                                        }}
                                                        className="text-sm font-medium text-text-primary group-hover:text-coral transition-colors"
                                                    >
                                                        {dept.name}
                                                    </Link>
                                                    <p className="text-xs text-text-tertiary mt-0.5">
                                                        {dept.memberCount}{' '}
                                                        {dept.memberCount === 1
                                                            ? 'member'
                                                            : 'members'}{' '}
                                                        · {dept.expenseCount}{' '}
                                                        expenses
                                                        {dept.role ===
                                                            'admin' && (
                                                            <span className="ml-2 text-coral font-semibold">
                                                                · admin
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <p className="font-mono font-semibold text-sm text-text-primary">
                                                        $
                                                        {dept.totalSpent.toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-text-tertiary">
                                                        of $
                                                        {dept.totalBudget.toLocaleString()}
                                                    </p>
                                                </div>
                                                {dept.role === 'admin' && (
                                                    <IconButton
                                                        onClick={() =>
                                                            setConfirmDelete(
                                                                dept.id
                                                            )
                                                        }
                                                        ariaLabel="Delete department"
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
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-2 bg-cream rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700 ease-out"
                                                style={{
                                                    width: `${dept.budgetUtilization}%`,
                                                    background:
                                                        dept.budgetUtilization >
                                                        90
                                                            ? 'linear-gradient(90deg, #FFB340, #FF3B30)'
                                                            : 'linear-gradient(90deg, #FF6B6B, #FFAB91)'
                                                }}
                                            />
                                        </div>
                                        {dept.pendingClaims > 0 && (
                                            <div className="mt-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                                                <span className="text-xs text-warning font-medium">
                                                    {dept.pendingClaims} pending
                                                    claim
                                                    {dept.pendingClaims !== 1
                                                        ? 's'
                                                        : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    </div>

                    {/* Organizations (Better Auth) */}
                    <div
                        className="border-b border-border-light pb-6"
                        style={{
                            opacity: revealed ? 1 : 0,
                            transition:
                                'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.38s'
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-semibold text-text-primary">
                                Organization Members
                            </h2>
                            {organizations.length > 0 && (
                                <span className="text-xs text-text-tertiary">
                                    {organizations.length} org
                                    {organizations.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        {organizations.length === 0 ? (
                            <div className="p-6 rounded-[10px] bg-cream/30 text-center">
                                <p className="text-sm text-text-tertiary">
                                    No organizations yet. Create a department to
                                    get started.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {organizations.map(
                                    (
                                        org: {
                                            id: string;
                                            name: string;
                                            slug?: string;
                                        },
                                        i: number
                                    ) => (
                                        <div
                                            key={org.id}
                                            className="p-4 rounded-[10px] hover:bg-cream/50 transition-colors duration-150 group"
                                            style={{
                                                opacity: revealed ? 1 : 0,
                                                transition: `opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${0.42 + i * 0.04}s`
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-coral/80 to-coral-dark/80 flex items-center justify-center shrink-0">
                                                        <svg
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="white"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                            <circle
                                                                cx="9"
                                                                cy="7"
                                                                r="4"
                                                            />
                                                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-text-primary truncate">
                                                                {org.name}
                                                            </p>
                                                            <span className="shrink-0 text-[10px] font-semibold text-text-tertiary bg-cream px-1.5 py-0.5 rounded-full">
                                                                org
                                                            </span>
                                                        </div>
                                                        {org.slug && (
                                                            <p className="text-xs text-text-tertiary mt-0.5">
                                                                {org.slug}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Button
                                                        onClick={() =>
                                                            setShowInviteDialog(
                                                                org.id
                                                            )
                                                        }
                                                        size="sm"
                                                        variant="ghost"
                                                        className="opacity-0 group-hover:opacity-100"
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
                                                                <circle
                                                                    cx="9"
                                                                    cy="7"
                                                                    r="4"
                                                                />
                                                                <line
                                                                    x1="19"
                                                                    y1="8"
                                                                    x2="19"
                                                                    y2="14"
                                                                />
                                                                <line
                                                                    x1="22"
                                                                    y1="11"
                                                                    x2="16"
                                                                    y2="11"
                                                                />
                                                            </svg>
                                                        }
                                                        ariaLabel="Invite member"
                                                    >
                                                        Invite
                                                    </Button>
                                                    <button
                                                        onClick={() =>
                                                            setExpandedOrg(
                                                                expandedOrg ===
                                                                    org.id
                                                                    ? null
                                                                    : org.id
                                                            )
                                                        }
                                                        data-cuelume-toggle
                                                        className={`p-1.5 rounded-[6px] transition-colors duration-150 ${
                                                            expandedOrg ===
                                                            org.id
                                                                ? 'text-coral bg-coral-light/30'
                                                                : 'text-text-tertiary hover:text-text-primary hover:bg-cream/60'
                                                        }`}
                                                        aria-label={
                                                            expandedOrg ===
                                                            org.id
                                                                ? 'Collapse members'
                                                                : 'Expand members'
                                                        }
                                                    >
                                                        <svg
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            className={`transition-transform duration-200 ${expandedOrg === org.id ? 'rotate-180' : ''}`}
                                                        >
                                                            <polyline points="6 9 12 15 18 9" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Members list (expanded) */}
                                            {expandedOrg === org.id && (
                                                <div
                                                    className="mt-3 pt-3 border-t border-border-light"
                                                    style={{
                                                        animation:
                                                            'fadeIn 0.2s ease-out'
                                                    }}
                                                >
                                                    {orgMembersLoading ? (
                                                        <div className="space-y-2 py-2">
                                                            {[1, 2, 3].map(
                                                                (i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="flex items-center gap-2.5"
                                                                    >
                                                                        <div className="w-7 h-7 rounded-full bg-cream animate-pulse" />
                                                                        <div className="flex-1 space-y-1">
                                                                            <div className="h-3 w-24 bg-cream rounded animate-pulse" />
                                                                            <div className="h-2.5 w-32 bg-cream/60 rounded animate-pulse" />
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : orgMembers.length ===
                                                      0 ? (
                                                        <p className="text-xs text-text-tertiary text-center py-3">
                                                            No members found
                                                        </p>
                                                    ) : (
                                                        <div className="space-y-1.5">
                                                            {orgMembers.map(
                                                                (member) => (
                                                                    <div
                                                                        key={
                                                                            member.id ||
                                                                            member.userId
                                                                        }
                                                                        className="flex items-center justify-between py-1.5 px-1 rounded-[6px] hover:bg-cream/40 transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-coral/70 to-coral-dark/70 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                                                                                {member.user?.name?.[0]?.toUpperCase() ??
                                                                                    member.user?.email?.[0]?.toUpperCase() ??
                                                                                    '?'}
                                                                            </div>
                                                                            <div className="min-w-0">
                                                                                <p className="text-sm font-medium text-text-primary truncate">
                                                                                    {member
                                                                                        .user
                                                                                        ?.name ??
                                                                                        member.user?.email?.split(
                                                                                            '@'
                                                                                        )[0] ??
                                                                                        'Unknown'}
                                                                                </p>
                                                                                {member
                                                                                    .user
                                                                                    ?.email && (
                                                                                    <p className="text-[11px] text-text-tertiary truncate">
                                                                                        {
                                                                                            member
                                                                                                .user
                                                                                                .email
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <span className="shrink-0 text-[10px] font-semibold text-text-tertiary bg-cream px-2 py-0.5 rounded-full capitalize">
                                                                            {
                                                                                member.role
                                                                            }
                                                                        </span>
                                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                                            <button
                                                                                onClick={() =>
                                                                                    updateMemberRole.mutate(
                                                                                        {
                                                                                            memberId:
                                                                                                member.id ??
                                                                                                member.userId ??
                                                                                                '',
                                                                                            role:
                                                                                                member.role ===
                                                                                                'admin'
                                                                                                    ? 'member'
                                                                                                    : 'admin'
                                                                                        }
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    updateMemberRole.isPending
                                                                                }
                                                                                className={`p-1 rounded-[4px] transition-colors ${updateMemberRole.isPending ? 'opacity-50' : 'text-text-tertiary hover:text-coral hover:bg-coral-light/30'}`}
                                                                                title={`Change role to ${member.role === 'admin' ? 'member' : 'admin'}`}
                                                                                data-cuelume-press
                                                                            >
                                                                                <svg
                                                                                    width="10"
                                                                                    height="10"
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2.5"
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                >
                                                                                    <polyline points="16 3 21 8 8 21 3 21 3 16 16 3" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={() =>
                                                                                    removeOrgMember.mutate(
                                                                                        {
                                                                                            memberIdOrEmail:
                                                                                                member
                                                                                                    .user
                                                                                                    ?.email ??
                                                                                                member.id ??
                                                                                                member.userId ??
                                                                                                '',
                                                                                            organizationId:
                                                                                                org.id
                                                                                        }
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    removeOrgMember.isPending
                                                                                }
                                                                                className={`p-1 rounded-[4px] transition-colors ${removeOrgMember.isPending ? 'opacity-50' : 'text-text-tertiary hover:text-error hover:bg-error/10'}`}
                                                                                title="Remove member"
                                                                                data-cuelume-press
                                                                            >
                                                                                <svg
                                                                                    width="10"
                                                                                    height="10"
                                                                                    viewBox="0 0 24 24"
                                                                                    fill="none"
                                                                                    stroke="currentColor"
                                                                                    strokeWidth="2.5"
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
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent Pending Claims */}
                    {recentClaims.length > 0 && (
                        <div
                            style={{
                                opacity: revealed ? 1 : 0,
                                transition:
                                    'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.45s'
                            }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold text-text-primary">
                                    Pending Claims
                                </h2>
                                <Link
                                    to="/company/claims"
                                    data-cuelume-press
                                    className="text-sm font-medium text-coral hover:text-coral-dark transition-colors"
                                >
                                    View all
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {recentClaims
                                    .slice(0, 5)
                                    .map(
                                        (
                                            claim: ClaimWithExpense,
                                            _: number
                                        ) => (
                                            <div
                                                key={claim.id}
                                                className="p-4 rounded-[10px] hover:bg-cream/50 transition-colors duration-150"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-text-primary truncate">
                                                            {
                                                                claim.expense
                                                                    .description
                                                            }
                                                        </p>
                                                        <p className="text-xs text-text-tertiary mt-0.5">
                                                            $
                                                            {(
                                                                claim.expense
                                                                    .amountCents /
                                                                100
                                                            ).toFixed(2)}{' '}
                                                            ·{' '}
                                                            {new Date(
                                                                claim.expense
                                                                    .date
                                                            ).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <span
                                                        className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[claim.status] ?? ''}`}
                                                    >
                                                        {claim.status}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Modals (always rendered) ──────────────────── */}
            {showCreateDept && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => {
                        setShowCreateDept(false);
                        setNewDeptName('');
                    }}
                >
                    <div
                        className="bg-surface rounded-[16px] shadow-warm-lg border border-border-light p-6 w-full max-w-sm mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-semibold text-text-primary mb-4">
                            Create Department
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Department Name
                                </label>
                                <input
                                    type="text"
                                    value={newDeptName}
                                    onChange={(e) =>
                                        setNewDeptName(e.target.value)
                                    }
                                    placeholder="e.g. Engineering, Marketing"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                            handleCreateDepartment();
                                    }}
                                    className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-border rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowCreateDept(false);
                                        setNewDeptName('');
                                    }}
                                    data-cuelume-press
                                    className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateDepartment}
                                    disabled={
                                        !newDeptName.trim() ||
                                        createGroup.isPending
                                    }
                                    data-cuelume-press
                                    className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-medium rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                                >
                                    {createGroup.isPending
                                        ? 'Creating...'
                                        : 'Create'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <CreateGroupDialog
                open={showCreateGroupDialog}
                onClose={() => setShowCreateGroupDialog(false)}
                kind="department"
            />

            <InviteMemberDialog
                open={!!showInviteDialog}
                onClose={() => setShowInviteDialog(null)}
                organizationId={showInviteDialog ?? ''}
            />

            {confirmDelete && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
                    onClick={() => setConfirmDelete(null)}
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
                            Delete Department?
                        </h3>
                        <p className="text-sm text-text-secondary text-center mb-6 leading-relaxed">
                            This will permanently delete this department and
                            remove all its members. Expenses will be kept but
                            unlinked.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmDelete(null)}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 rounded-[10px] text-sm font-medium text-text-secondary border border-border-light hover:bg-cream/50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() =>
                                    handleDeleteDepartment(confirmDelete)
                                }
                                disabled={deletingDept === confirmDelete}
                                data-cuelume-press
                                className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-[10px] hover:bg-error/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                            >
                                {deletingDept === confirmDelete
                                    ? 'Deleting...'
                                    : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
