import { authClient } from './auth-client';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { data: session } = await authClient.getSession();
    const res = await fetch(`${BASE}/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(session?.session?.token
                ? { Authorization: `Bearer ${session.session.token}` }
                : {}),
            ...options.headers
        },
        credentials: 'include'
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
            body?.error?.message ?? `Request failed: ${res.status}`
        );
    }

    const json = await res.json();
    return json.data as T;
}

// ─── Expenses ───────────────────────────────────────────────────────

export const expensesApi = {
    list: (params?: {
        groupId?: string;
        scope?: string;
        categoryId?: string;
        page?: number;
        pageSize?: number;
    }) => {
        const search = new URLSearchParams();
        if (params?.groupId) search.set('groupId', params.groupId);
        if (params?.scope) search.set('scope', params.scope);
        if (params?.categoryId) search.set('categoryId', params.categoryId);
        if (params?.page) search.set('page', String(params.page));
        if (params?.pageSize) search.set('pageSize', String(params.pageSize));
        const qs = search.toString();
        return request<
            import('@expense/shared').PaginatedData<
                import('@expense/shared').Expense
            >
        >(`/expenses${qs ? `?${qs}` : ''}`);
    },

    get: (id: string) =>
        request<import('@expense/shared').Expense>(`/expenses/${id}`),

    create: (data: import('@expense/shared').CreateExpenseInput) =>
        request<import('@expense/shared').Expense>('/expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        }),

    revise: (id: string, data: import('@expense/shared').ReviseExpenseInput) =>
        request<import('@expense/shared').Expense>(`/expenses/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),

    delete: (id: string, data: import('@expense/shared').DeleteExpenseInput) =>
        request<{ deleted: boolean }>(`/expenses/${id}`, {
            method: 'DELETE',
            body: JSON.stringify(data)
        })
};

// ─── Groups ─────────────────────────────────────────────────────────

export const groupsApi = {
    list: () => request<import('@expense/shared').Group[]>('/groups'),
    get: (id: string) =>
        request<import('@expense/shared').Group>(`/groups/${id}`),
    create: (data: import('@expense/shared').CreateGroupInput) =>
        request<import('@expense/shared').Group>('/groups', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/groups/${id}`, { method: 'DELETE' })
};

// ─── Settlements ────────────────────────────────────────────────────

export const settlementsApi = {
    list: (groupId?: string) =>
        request<import('@expense/shared').Settlement[]>(
            `/settlements${groupId ? `?groupId=${groupId}` : ''}`
        ),
    create: (data: import('@expense/shared').CreateSettlementInput) =>
        request<import('@expense/shared').Settlement>('/settlements', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    balances: (groupId: string) =>
        request<{ userId: string; userName: string; balanceCents: number }[]>(
            `/settlements/balances/${groupId}`
        ),
    correct: (
        data: import('@expense/shared').CreateSettlementCorrectionInput
    ) =>
        request<import('@expense/shared').SettlementCorrection>(
            '/settlements/correct',
            {
                method: 'POST',
                body: JSON.stringify(data)
            }
        )
};

// ─── Budgets ────────────────────────────────────────────────────────

export const budgetsApi = {
    list: () => request<import('@expense/shared').Budget[]>('/budgets'),
    create: (data: import('@expense/shared').CreateBudgetInput) =>
        request<import('@expense/shared').Budget>('/budgets', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: import('@expense/shared').UpdateBudgetInput) =>
        request<import('@expense/shared').Budget>(`/budgets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/budgets/${id}`, { method: 'DELETE' })
};

// ─── Categories ─────────────────────────────────────────────────────

export const categoriesApi = {
    list: () => request<import('@expense/shared').Category[]>('/categories'),
    create: (data: import('@expense/shared').CreateCategoryInput) =>
        request<import('@expense/shared').Category>('/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: import('@expense/shared').UpdateCategoryInput) =>
        request<import('@expense/shared').Category>(`/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/categories/${id}`, { method: 'DELETE' })
};

// ─── Claims ─────────────────────────────────────────────────────────

export const claimsApi = {
    list: (params?: { status?: string; userId?: string }) => {
        const search = new URLSearchParams();
        if (params?.status) search.set('status', params.status);
        if (params?.userId) search.set('userId', params.userId);
        const qs = search.toString();
        return request<ClaimWithExpense[]>(`/claims${qs ? `?${qs}` : ''}`);
    },
    create: (data: import('@expense/shared').CreateClaimInput) =>
        request<import('@expense/shared').Claim>('/claims', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    approve: (id: string) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/approve`, {
            method: 'POST'
        }),
    reject: (id: string, note?: string) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ note })
        }),
    reimburse: (id: string) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/reimburse`, {
            method: 'POST'
        })
};

// ─── Adjustments ────────────────────────────────────────────────────

export const adjustmentsApi = {
    list: (expenseId: string) =>
        request<import('@expense/shared').Adjustment[]>(
            `/adjustments/expense/${expenseId}`
        ),
    request: (data: import('@expense/shared').CreateAdjustmentInput) =>
        request<import('@expense/shared').Adjustment>('/adjustments', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    approve: (id: string) =>
        request<import('@expense/shared').Adjustment>(
            `/adjustments/${id}/approve`,
            {
                method: 'POST'
            }
        ),
    reject: (id: string, reason?: string) =>
        request<import('@expense/shared').Adjustment>(
            `/adjustments/${id}/reject`,
            {
                method: 'POST',
                body: JSON.stringify({ reason })
            }
        )
};

// ─── Memberships ─────────────────────────────────────────────────────

export const membershipsApi = {
    list: (groupId: string) =>
        request<import('@expense/shared').Membership[]>(
            `/memberships?groupId=${groupId}`
        ),
    add: (data: { groupId: string; email: string; role?: string }) =>
        request<import('@expense/shared').Membership>('/memberships', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    remove: (id: string) =>
        request<{ deleted: boolean }>(`/memberships/${id}`, {
            method: 'DELETE'
        }),
    update: (id: string, data: { role: string }) =>
        request<import('@expense/shared').Membership>(`/memberships/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        })
};

// ─── Uploads ───────────────────────────────────────────────────────

export const uploadsApi = {
    uploadReceipt: async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const { data: session } = await authClient.getSession();
        const res = await fetch(`${BASE}/api/uploads`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            headers: session?.session?.token
                ? { Authorization: `Bearer ${session.session.token}` }
                : {}
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.message ?? 'Upload failed');
        }
        const json = await res.json();
        return json.data as { url: string };
    }
};

// ─── Users ───────────────────────────────────────────────────────────

export const usersApi = {
    search: (email: string) =>
        request<{ id: string; name: string; email: string }[]>(
            `/users/search?email=${encodeURIComponent(email)}`
        )
};

// ─── Organizations ───────────────────────────────────────────────────

export interface OrganizationMember {
    id?: string;
    userId: string;
    role: string;
    user?: { name?: string; email?: string };
}

export const orgApi = {
    list: () =>
        request<{ id: string; name: string; slug?: string }[]>(
            '/organizations'
        ),
    members: (orgId: string) =>
        request<OrganizationMember[]>(`/organizations/${orgId}/members`),
    removeMember: (orgId: string, memberIdOrEmail: string) =>
        request<{ deleted: boolean }>(`/organizations/${orgId}/members`, {
            method: 'DELETE',
            body: JSON.stringify({ memberIdOrEmail })
        }),
    updateMemberRole: (orgId: string, memberId: string, role: string) =>
        request<OrganizationMember>(
            `/organizations/${orgId}/members/${memberId}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ role })
            }
        )
};

// ─── Company Summary ─────────────────────────────────────────────────

export interface CompanySummary {
    departments: {
        id: string;
        name: string;
        memberCount: number;
        expenseCount: number;
        role: string;
        totalBudget: number;
        totalSpent: number;
        budgetUtilization: number;
        pendingClaims: number;
    }[];
    totalBudget: number;
    totalSpent: number;
    pendingClaims: number;
}

export const companyApi = {
    summary: () => request<CompanySummary>('/groups/summary')
};

export interface ClaimWithExpense {
    id: string;
    expenseId: string;
    status: string;
    reviewerId?: string;
    reviewNote?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
    expense: import('@expense/shared').Expense;
}
