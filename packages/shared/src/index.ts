export interface Expense {
  id: string;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  receiptUrl?: string;
  userId: string;
  groupId?: string;
  scope: "personal" | "group" | "company";
  createdAt: string;
  updatedAt: string;
}

export interface Split {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
}

export interface Claim {
  id: string;
  expenseId: string;
  status: "submitted" | "approved" | "rejected" | "reimbursed";
  reviewerId?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  kind: "social" | "department";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  groupId: string;
  userId: string;
  role: "admin" | "member";
  createdAt: string;
}

export interface Settlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  groupId?: string;
  note?: string;
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
  amount: number;
  period: "monthly" | "weekly" | "yearly";
  userId?: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateExpenseInput = Omit<Expense, "id" | "createdAt" | "updatedAt">;
export type UpdateExpenseInput = Partial<Omit<Expense, "id" | "createdAt" | "updatedAt">>;

export type CreateGroupInput = Omit<Group, "id" | "createdAt" | "updatedAt">;
export type CreateSettlementInput = Omit<Settlement, "id" | "createdAt">;
export type CreateCategoryInput = Omit<Category, "id" | "createdAt">;
export type CreateBudgetInput = Omit<Budget, "id" | "createdAt" | "updatedAt">;
export type CreateClaimInput = Omit<Claim, "id" | "createdAt" | "updatedAt" | "reviewerId" | "reviewNote" | "reviewedAt">;

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
