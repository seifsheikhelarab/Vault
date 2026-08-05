// ─── Money ──────────────────────────────────────────────────────────────────
// All monetary values are in integer cents (bigint in DB, safe integer in JSON).
// Display formatting to dollars happens only at the UI presentation boundary.

export const BUSINESS_MAX_CENTS = 100_000_000; // $1,000,000.00
export const BUSINESS_MIN_CENTS = -100_000_000;

/** Convert a dollar string or number to cents. Throws on non-integer input. */
export function dollarsToCents(dollars: number | string): number {
    const d = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
    if (!Number.isFinite(d)) throw new Error('Invalid dollar amount');
    const cents = Math.round(d * 100);
    if (cents > BUSINESS_MAX_CENTS || cents < BUSINESS_MIN_CENTS) {
        throw new Error(`Amount exceeds business maximum of ${BUSINESS_MAX_CENTS / 100}`);
    }
    return cents;
}

/** Convert cents to a display-friendly dollar string (e.g. "123.45"). */
export function centsToDollars(cents: number): string {
    return (cents / 100).toFixed(2);
}

/** Convert cents to a raw dollar number for charts/computation. */
export function centsToDollarNumber(cents: number): number {
    return Math.round(cents) / 100;
}

// ─── Entities ───────────────────────────────────────────────────────────────

export interface Expense {
    id: string;
    amountCents: number;
    description: string;
    date: string;
    receiptUrl?: string;
    scope: 'personal' | 'group' | 'company';
    userId: string;
    groupId?: string;
    categoryId: string;
    payerNameSnapshot: string;
    payerEmailSnapshot: string;
    currentRevisionId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExpenseRevision {
    id: string;
    expenseId: string;
    version: number;
    amountCents: number;
    description: string;
    categoryId: string;
    authorId: string;
    authorNameSnapshot: string;
    authorEmailSnapshot: string;
    reason: string;
    createdAt: string;
}

export interface ExpenseTombstone {
    id: string;
    expenseId: string;
    authorId: string;
    authorNameSnapshot: string;
    authorEmailSnapshot: string;
    reason: string;
    createdAt: string;
}

export interface Split {
    id: string;
    expenseId: string;
    userId: string;
    amountCents: number;
    userNameSnapshot: string;
    userEmailSnapshot: string;
    createdAt: string;
}

export interface Adjustment {
    id: string;
    expenseId: string;
    amountCents: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    requesterId: string;
    requesterNameSnapshot: string;
    requesterEmailSnapshot: string;
    reviewerId?: string;
    reviewerNameSnapshot?: string;
    reviewerEmailSnapshot?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdjustmentAllocation {
    id: string;
    adjustmentId: string;
    userId: string;
    amountCentsDelta: number;
    userNameSnapshot: string;
    userEmailSnapshot: string;
}

export interface Claim {
    id: string;
    expenseId: string;
    status: 'submitted' | 'approved' | 'rejected' | 'reimbursed';
    reviewerId?: string;
    reviewNote?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Group {
    id: string;
    name: string;
    kind: 'social' | 'department';
    organizationId?: string;
    createdBy: string;
    closed: boolean;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Membership {
    id: string;
    groupId: string;
    userId: string;
    role: 'admin' | 'member';
    createdAt: string;
    user?: {
        name: string;
        email: string;
    };
}

export interface Settlement {
    id: string;
    fromUserId: string;
    fromUserNameSnapshot: string;
    fromUserEmailSnapshot: string;
    toUserId: string;
    toUserNameSnapshot: string;
    toUserEmailSnapshot: string;
    amountCents: number;
    groupId?: string;
    note?: string;
    debtContextSnapshot?: unknown;
    createdAt: string;
}

export interface SettlementCorrection {
    id: string;
    originalSettlementId: string;
    amountCents: number;
    reason: string;
    requesterId: string;
    requesterNameSnapshot: string;
    requesterEmailSnapshot: string;
    approved: boolean;
    createdAt: string;
}

export interface Category {
    id: string;
    name: string;
    icon?: string;
    userId?: string;
    createdAt: string;
}

export interface Budget {
    id: string;
    categoryId: string;
    amountCents: number;
    period: 'monthly' | 'weekly' | 'yearly';
    userId?: string;
    groupId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AuditEvent {
    id: string;
    actorId: string;
    actorNameSnapshot: string;
    actorEmailSnapshot: string;
    action: string;
    groupId?: string;
    targetType: string;
    targetId: string;
    beforeRef?: unknown;
    afterRef?: unknown;
    reason?: string;
    createdAt: string;
}

// ─── Input types ────────────────────────────────────────────────────────────

export interface CreateExpenseInput {
    amountCents: number;
    description: string;
    categoryId: string;
    date: string;
    scope?: 'personal' | 'group' | 'company';
    groupId?: string;
    receiptUrl?: string;
    splits?: CreateSplitInput[];
}

export interface ReviseExpenseInput {
    amountCents: number;
    description: string;
    categoryId: string;
    reason: string;
}

export interface DeleteExpenseInput {
    reason: string;
}

export interface CreateSplitInput {
    userId: string;
    amountCents: number;
}

export interface CreateGroupInput {
    name: string;
    kind?: 'social' | 'department';
}

export interface CreateSettlementInput {
    toUserId: string;
    amountCents: number;
    groupId?: string;
    note?: string;
}

export interface CreateSettlementCorrectionInput {
    originalSettlementId: string;
    reason: string;
}

export interface CreateCategoryInput {
    name: string;
    icon?: string;
}

export interface UpdateCategoryInput {
    name?: string;
    icon?: string | null;
}

export interface CreateBudgetInput {
    categoryId: string;
    amountCents: number;
    period?: 'monthly' | 'weekly' | 'yearly';
    groupId?: string;
}

export interface UpdateBudgetInput {
    amountCents?: number;
    period?: 'monthly' | 'weekly' | 'yearly';
}

export interface CreateAdjustmentInput {
    expenseId: string;
    amountCents: number;
    reason: string;
    allocations: CreateAdjustmentAllocationInput[];
}

export interface CreateAdjustmentAllocationInput {
    userId: string;
    amountCentsDelta: number;
}

export interface ApproveAdjustmentInput {
    id: string;
}

export interface RejectAdjustmentInput {
    id: string;
    reason?: string;
}

export interface CreateClaimInput {
    expenseId: string;
}

// ─── API response ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
    };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedData<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}
