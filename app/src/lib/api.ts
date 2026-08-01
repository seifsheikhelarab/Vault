import type { ApiResponse, ApiError, PaginatedData } from '@expense/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const isFormData = init?.body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: isFormData
            ? init?.headers
            : { 'Content-Type': 'application/json', ...init?.headers },
        ...init
    });
    const json = (await res.json()) as ApiResponse<T> | ApiError;
    if (!json.success) throw new Error(json.error?.message ?? 'Request failed');
    return (json as ApiResponse<T>).data;
}

// ─── Expenses ──────────────────────────────────────────────────────

export interface ExpenseListParams {
    page?: number;
    pageSize?: number;
    categoryId?: string;
    scope?: string;
    groupId?: string;
}

export const expensesApi = {
    list: (params?: ExpenseListParams) => {
        const q = new URLSearchParams();
        if (params?.page) q.set('page', String(params.page));
        if (params?.pageSize) q.set('pageSize', String(params.pageSize));
        if (params?.categoryId) q.set('categoryId', params.categoryId);
        if (params?.scope) q.set('scope', params.scope);
        if (params?.groupId) q.set('groupId', params.groupId);
        const qs = q.toString();
        return request<PaginatedData<import('@expense/shared').Expense>>(
            `/expenses${qs ? `?${qs}` : ''}`
        );
    },
    get: (id: string) =>
        request<import('@expense/shared').Expense>(`/expenses/${id}`),
    create: (data: Record<string, unknown>) =>
        request<import('@expense/shared').Expense>('/expenses', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: Record<string, unknown>) =>
        request<import('@expense/shared').Expense>(`/expenses/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/expenses/${id}`, { method: 'DELETE' })
};

// ─── Categories ────────────────────────────────────────────────────

export const categoriesApi = {
    list: () => request<import('@expense/shared').Category[]>('/categories'),
    create: (data: Record<string, unknown>) =>
        request<import('@expense/shared').Category>('/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: Record<string, unknown>) =>
        request<import('@expense/shared').Category>(`/categories/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/categories/${id}`, {
            method: 'DELETE'
        })
};

// ─── Budgets ───────────────────────────────────────────────────────

export const budgetsApi = {
    list: () => request<import('@expense/shared').Budget[]>('/budgets'),
    create: (data: Record<string, unknown>) =>
        request<import('@expense/shared').Budget>('/budgets', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: Record<string, unknown>) =>
        request<import('@expense/shared').Budget>(`/budgets/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/budgets/${id}`, { method: 'DELETE' })
};

// ─── Groups ────────────────────────────────────────────────────────

export const groupsApi = {
    list: () => request<import('@expense/shared').Group[]>('/groups'),
    get: (id: string) =>
        request<import('@expense/shared').Group>(`/groups/${id}`),
    create: (data: Record<string, unknown>) =>
        request<import('@expense/shared').Group>('/groups', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    update: (id: string, data: Record<string, unknown>) =>
        request<import('@expense/shared').Group>(`/groups/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    delete: (id: string) =>
        request<{ deleted: boolean }>(`/groups/${id}`, { method: 'DELETE' }),
    balances: (id: string) =>
        request<{
            net: Record<string, number>;
            debts: { from: string; to: string; amount: number }[];
        }>(`/groups/${id}/balances`)
};

// ─── Memberships ─────────────────────────────────────────────────

export const membershipsApi = {
    list: (groupId: string) =>
        request<import('@expense/shared').Membership[]>(
            `/memberships?groupId=${groupId}`
        ),
    add: (groupId: string, data: { email: string; role?: string }) =>
        request<import('@expense/shared').Membership>(
            `/memberships?groupId=${groupId}`,
            {
                method: 'POST',
                body: JSON.stringify(data)
            }
        ),
    update: (id: string, data: { role?: string }) =>
        request<import('@expense/shared').Membership>(`/memberships/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
    remove: (id: string) =>
        request<{ deleted: boolean }>(`/memberships/${id}`, {
            method: 'DELETE'
        })
};

// ─── Settlements ─────────────────────────────────────────────────

export const settlementsApi = {
    list: (groupId?: string) => {
        const qs = groupId ? `?groupId=${groupId}` : '';
        return request<import('@expense/shared').Settlement[]>(
            `/settlements${qs}`
        );
    },
    get: (id: string) =>
        request<import('@expense/shared').Settlement>(`/settlements/${id}`),
    create: (data: {
        toUserId: string;
        amount: number;
        groupId?: string;
        note?: string;
    }) =>
        request<import('@expense/shared').Settlement>('/settlements', {
            method: 'POST',
            body: JSON.stringify(data)
        })
};

// ─── Claims ──────────────────────────────────────────────────────

export interface ClaimWithExpense {
    id: string;
    expenseId: string;
    status: 'submitted' | 'approved' | 'rejected' | 'reimbursed';
    reviewerId?: string;
    reviewNote?: string;
    reviewedAt?: string;
    createdAt: string;
    updatedAt: string;
    expense: {
        id: string;
        amount: string;
        description: string;
        date: string;
        userId: string;
        categoryId: string;
        groupId?: string;
        receiptUrl?: string;
        scope: string;
    };
}

export interface CompanySummary {
    departments: {
        id: string;
        name: string;
        role: string;
        memberCount: number;
        totalBudget: number;
        totalSpent: number;
        budgetUtilization: number;
        pendingClaims: number;
        expenseCount: number;
        createdAt: string;
    }[];
    totalBudget: number;
    totalSpent: number;
    pendingClaims: number;
}

export const claimsApi = {
    list: (params?: { groupId?: string; userId?: string; status?: string }) => {
        const q = new URLSearchParams();
        if (params?.groupId) q.set('groupId', params.groupId);
        if (params?.userId) q.set('userId', params.userId);
        if (params?.status) q.set('status', params.status);
        const qs = q.toString();
        return request<ClaimWithExpense[]>(`/claims${qs ? `?${qs}` : ''}`);
    },
    create: (data: { expenseId: string }) =>
        request<import('@expense/shared').Claim>('/claims', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    approve: (id: string) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/approve`, {
            method: 'PATCH'
        }),
    reject: (id: string, data?: { note?: string }) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify(data ?? {})
        }),
    reimburse: (id: string) =>
        request<import('@expense/shared').Claim>(`/claims/${id}/reimburse`, {
            method: 'PATCH'
        })
};

// ─── Company Summary ─────────────────────────────────────────────

export const companyApi = {
    summary: () => request<CompanySummary>('/groups/company-summary')
};

// ─── Users ─────────────────────────────────────────────────────

export const usersApi = {
    search: (q: string) =>
        request<{ id: string; name: string; email: string }[]>(
            `/users/search?q=${encodeURIComponent(q)}`
        )
};

// ─── Uploads ─────────────────────────────────────────────────────

export const uploadsApi = {
    uploadReceipt: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return request<{ url: string }>('/uploads', {
            method: 'POST',
            body: formData
        });
    }
};

// ─── Splits ──────────────────────────────────────────────────────

export const splitsApi = {
    create: (data: {
        expenseId: string;
        splits: { userId: string; amount: number }[];
    }) =>
        request<import('@expense/shared').Split[]>('/splits', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
    list: (expenseId: string) =>
        request<import('@expense/shared').Split[]>(
            `/splits?expenseId=${expenseId}`
        ),
    delete: (expenseId: string) =>
        request<{ deleted: boolean }>(`/splits?expenseId=${expenseId}`, {
            method: 'DELETE'
        })
};
