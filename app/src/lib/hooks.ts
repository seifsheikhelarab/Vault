import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi, categoriesApi, budgetsApi, groupsApi, membershipsApi, settlementsApi, claimsApi, companyApi } from "./api";
import type { Expense, Category, Budget, Group } from "@expense/shared";

// ─── Expenses ──────────────────────────────────────────────────────

export function useExpenses(params?: { page?: number; pageSize?: number; categoryId?: string; scope?: string }) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () => expensesApi.list(params),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ["expense", id],
    queryFn: () => expensesApi.get(id),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; description: string; date: string; categoryId: string; scope?: string; groupId?: string; receiptUrl?: string }) =>
      expensesApi.create({ ...data, scope: data.scope ?? "personal" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ─── Categories ────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string }) => categoriesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

// ─── Budgets ───────────────────────────────────────────────────────

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: () => budgetsApi.list(),
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoryId: string; amount: number; period?: string; groupId?: string }) =>
      budgetsApi.create({ ...data, period: data.period ?? "monthly" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; amount?: number; period?: string }) =>
      budgetsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

// ─── Groups ────────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => groupsApi.list(),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; kind?: string }) =>
      groupsApi.create({ ...data, kind: data.kind ?? "social" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

// ─── Group Detail ──────────────────────────────────────────────

export function useGroup(id: string) {
  return useQuery({
    queryKey: ["group", id],
    queryFn: () => groupsApi.get(id),
    enabled: !!id,
  });
}

// ─── Memberships ──────────────────────────────────────────────

export function useMembers(groupId: string) {
  return useQuery({
    queryKey: ["members", groupId],
    queryFn: () => membershipsApi.list(groupId),
    enabled: !!groupId,
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId, role }: { groupId: string; userId: string; role?: string }) =>
      membershipsApi.add(groupId, { userId, role }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["members", vars.groupId] });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => membershipsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

// ─── Balances ─────────────────────────────────────────────────

export function useBalances(groupId: string) {
  return useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => groupsApi.balances(groupId),
    enabled: !!groupId,
  });
}

// ─── Settlements ──────────────────────────────────────────────

export function useSettlements(groupId?: string) {
  return useQuery({
    queryKey: ["settlements", groupId],
    queryFn: () => settlementsApi.list(groupId),
  });
}

export function useCreateSettlement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { toUserId: string; amount: number; groupId?: string; note?: string }) =>
      settlementsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settlements"] });
      qc.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

// ─── Delete Group ─────────────────────────────────────────────

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

// ─── Claims ──────────────────────────────────────────────────────

export function useClaims(params?: { groupId?: string; userId?: string; status?: string }) {
  return useQuery({
    queryKey: ["claims", params],
    queryFn: () => claimsApi.list(params),
  });
}

export function useCreateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { expenseId: string }) => claimsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useApproveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => claimsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useRejectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => claimsApi.reject(id, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

export function useReimburseClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => claimsApi.reimburse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

// ─── Company Summary ─────────────────────────────────────────────

export function useCompanySummary() {
  return useQuery({
    queryKey: ["company"],
    queryFn: () => companyApi.summary(),
  });
}
