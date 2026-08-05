import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    expensesApi,
    categoriesApi,
    budgetsApi,
    groupsApi,
    membershipsApi,
    settlementsApi,
    claimsApi,
    companyApi,
    usersApi,
    adjustmentsApi,
    uploadsApi
} from './api';
import { authClient } from './auth-client';

// ─── Expenses ──────────────────────────────────────────────────────

export function useExpenses(params?: {
    page?: number;
    pageSize?: number;
    categoryId?: string;
    scope?: string;
    groupId?: string;
}) {
    return useQuery({
        queryKey: ['expenses', params],
        queryFn: () => expensesApi.list(params)
    });
}

export function useExpense(id: string) {
    return useQuery({
        queryKey: ['expense', id],
        queryFn: () => expensesApi.get(id),
        enabled: !!id
    });
}

export function useCreateExpense() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: import('@expense/shared').CreateExpenseInput) =>
            expensesApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
    });
}

export function useUpdateExpense() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            ...data
        }: {
            id: string;
            amountCents: number;
            description: string;
            categoryId: string;
            reason: string;
        }) => expensesApi.revise(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
    });
}

export function useDeleteExpense() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            expensesApi.delete(id, { reason }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['expenses'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
        }
    });
}

// ─── Categories ────────────────────────────────────────────────────

export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: () => categoriesApi.list()
    });
}

export function useCreateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; icon?: string }) =>
            categoriesApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
    });
}

export function useUpdateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            ...data
        }: {
            id: string;
            name?: string;
            icon?: string | null;
        }) => categoriesApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
    });
}

export function useDeleteCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => categoriesApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
    });
}

// ─── Budgets ───────────────────────────────────────────────────────

export function useBudgets() {
    return useQuery({
        queryKey: ['budgets'],
        queryFn: () => budgetsApi.list()
    });
}

export function useCreateBudget() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: import('@expense/shared').CreateBudgetInput) =>
            budgetsApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['budgets'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

export function useUpdateBudget() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            ...data
        }: { id: string } & import('@expense/shared').UpdateBudgetInput) =>
            budgetsApi.update(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['budgets'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

export function useDeleteBudget() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => budgetsApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['budgets'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

// ─── Groups ────────────────────────────────────────────────────────

export function useGroups() {
    return useQuery({
        queryKey: ['groups'],
        queryFn: () => groupsApi.list()
    });
}

export function useCreateGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: import('@expense/shared').CreateGroupInput) =>
            groupsApi.create(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
    });
}

export function useGroup(id: string) {
    return useQuery({
        queryKey: ['group', id],
        queryFn: () => groupsApi.get(id),
        enabled: !!id
    });
}

// ─── Memberships ──────────────────────────────────────────────

export function useMembers(groupId: string) {
    return useQuery({
        queryKey: ['members', groupId],
        queryFn: () => membershipsApi.list(groupId),
        enabled: !!groupId
    });
}

export function useAddMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            groupId,
            email,
            role
        }: {
            groupId: string;
            email: string;
            role?: string;
        }) => membershipsApi.add({ groupId, email, role }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ['members', vars.groupId] });
        }
    });
}

export function useUpdateMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: { id: string; role: string }) =>
            membershipsApi.update(id, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] })
    });
}

export function useRemoveMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => membershipsApi.remove(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] })
    });
}

// ─── Balances ─────────────────────────────────────────────────

export function useBalances(groupId: string) {
    return useQuery({
        queryKey: ['balances', groupId],
        queryFn: () => settlementsApi.balances(groupId),
        enabled: !!groupId
    });
}

// ─── Settlements ──────────────────────────────────────────────

export function useSettlements(groupId?: string) {
    return useQuery({
        queryKey: ['settlements', groupId],
        queryFn: () => settlementsApi.list(groupId)
    });
}

export function useCreateSettlement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            toUserId: string;
            amountCents: number;
            groupId?: string;
            note?: string;
        }) => settlementsApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['settlements'] });
            qc.invalidateQueries({ queryKey: ['balances'] });
        }
    });
}

// ─── Users ─────────────────────────────────────────────────────

export function useUserSearch(query: string) {
    return useQuery({
        queryKey: ['users', 'search', query],
        queryFn: () => usersApi.search(query),
        enabled: query.length >= 2,
        staleTime: 30_000,
        placeholderData: (prev) => prev
    });
}

// ─── Delete Group ─────────────────────────────────────────────

export function useDeleteGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => groupsApi.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
    });
}

// ─── Claims ──────────────────────────────────────────────────────

export function useClaims(params?: {
    groupId?: string;
    userId?: string;
    status?: string;
}) {
    return useQuery({
        queryKey: ['claims', params],
        queryFn: () => claimsApi.list(params)
    });
}

export function useCreateClaim() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: { expenseId: string }) => claimsApi.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['claims'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

export function useApproveClaim() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => claimsApi.approve(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['claims'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

export function useRejectClaim() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, note }: { id: string; note?: string }) =>
            claimsApi.reject(id, note),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['claims'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

export function useReimburseClaim() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => claimsApi.reimburse(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['claims'] });
            qc.invalidateQueries({ queryKey: ['company'] });
        }
    });
}

// ─── Adjustments ──────────────────────────────────────────────

export function useCreateAdjustment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: Parameters<typeof adjustmentsApi.request>[0]) =>
            adjustmentsApi.request(data),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] })
    });
}

export function useApproveAdjustment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => adjustmentsApi.approve(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] })
    });
}

// ─── Organization Plugins (Better Auth) ──────────────────────

export function useOrganizations() {
    return useQuery({
        queryKey: ['organizations'],
        queryFn: async () => {
            const { data, error } = await authClient.organization.list();
            if (error)
                throw new Error(
                    error.message ?? 'Failed to list organizations'
                );
            return data ?? [];
        }
    });
}

export function useCreateOrganization() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            name: string;
            slug: string;
            metadata?: Record<string, unknown>;
        }) => {
            const { data: org, error } =
                await authClient.organization.create(data);
            if (error)
                throw new Error(
                    error.message ?? 'Failed to create organization'
                );
            return org!;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['organizations'] });
            qc.invalidateQueries({ queryKey: ['groups'] });
        }
    });
}

interface OrgMember {
    id?: string;
    userId?: string;
    role: string;
    user?: { name?: string | null; email?: string | null };
}

export function useOrganizationMembers(organizationId?: string) {
    return useQuery({
        queryKey: ['organization-members', organizationId],
        queryFn: async () => {
            if (!organizationId) return [] as OrgMember[];
            const { data, error } =
                await authClient.organization.getFullOrganization({
                    query: { organizationId }
                });
            if (error)
                throw new Error(
                    error.message ?? 'Failed to get organization members'
                );
            return ((data as { members?: OrgMember[] })?.members ??
                []) as OrgMember[];
        },
        enabled: !!organizationId
    });
}

export function useInviteMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            organizationId: string;
            email: string;
            role: string;
        }) => {
            const { data: invitation, error } =
                await authClient.organization.inviteMember(
                    data as unknown as Parameters<
                        typeof authClient.organization.inviteMember
                    >[0]
                );
            if (error)
                throw new Error(error.message ?? 'Failed to invite member');
            return invitation!;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['organization-members'] });
            qc.invalidateQueries({ queryKey: ['members'] });
        }
    });
}

export function useRemoveOrgMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            memberIdOrEmail: string;
            organizationId?: string;
        }) => {
            const { error } = await authClient.organization.removeMember(
                data as {
                    memberIdOrEmail: string;
                    organizationId?: string;
                }
            );
            if (error)
                throw new Error(error.message ?? 'Failed to remove member');
        },
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: ['organization-members'] })
    });
}

export function useUpdateMemberRole() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: { memberId: string; role: string }) => {
            const { error } = await authClient.organization.updateMemberRole(
                data as {
                    memberId: string;
                    role: string;
                }
            );
            if (error)
                throw new Error(error.message ?? 'Failed to update role');
        },
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: ['organization-members'] })
    });
}

// ─── Company Summary ─────────────────────────────────────────────

export function useCompanySummary() {
    return useQuery({
        queryKey: ['company'],
        queryFn: () => companyApi.summary()
    });
}

// ─── Uploads ─────────────────────────────────────────────────────

export function useUploadReceipt() {
    return useMutation<{ url: string }, Error, File>({
        mutationFn: (file: File) => uploadsApi.uploadReceipt(file)
    });
}

// ─── Splits ──────────────────────────────────────────────────

export function useCreateSplits() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (_data: {
            expenseId: string;
            splits: { userId: string; amountCents: number }[];
        }) => {
            // Splits are created atomically with the expense now
            return Promise.resolve([]);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['balances'] });
            qc.invalidateQueries({ queryKey: ['expenses'] });
        }
    });
}

// ─── Update Group ──────────────────────────────────────────────

export function useUpdateGroup() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...data }: { id: string; name?: string }) =>
            Promise.resolve({ id, name: data.name ?? '' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['groups'] });
            qc.invalidateQueries({ queryKey: ['group'] });
        }
    });
}
