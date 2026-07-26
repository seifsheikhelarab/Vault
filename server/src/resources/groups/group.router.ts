import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { ok, fail } from "../../lib/response";
import { db } from "../../lib/db";
import { groups, memberships, expenses, splits, settlements, budgets, claims } from "../../lib/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { AppEnv } from "../../lib/middleware";

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["social", "department"]).default("social"),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  kind: z.enum(["social", "department"]).optional(),
});

const group = new Hono<AppEnv>();

// Create group + auto-add creator as admin member
group.post(
  "/",
  zValidator("json", createGroupSchema),
  async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const groupId = crypto.randomUUID();

    const result = await db.transaction(async (tx) => {
      const [g] = await tx
        .insert(groups)
        .values({ ...body, id: groupId, createdBy: userId })
        .returning();
      await tx
        .insert(memberships)
        .values({ id: crypto.randomUUID(), groupId, userId, role: "admin" });
      return g;
    });

    return c.json(ok(result), 201);
  }
);

// List groups the user belongs to
group.get("/", async (c) => {
  const userId = c.get("userId");
  const data = await db
    .select({ group: groups })
    .from(groups)
    .innerJoin(memberships, eq(memberships.groupId, groups.id))
    .where(eq(memberships.userId, userId))
    .orderBy(desc(groups.createdAt));
  return c.json(ok(data.map((r) => r.group)));
});

// Get group by ID (must be member)
group.get("/:id", async (c) => {    const userId = c.get("userId");
    const id = c.req.param("id");

    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
    if (!membership) return c.json(fail("FORBIDDEN", "Not a member"), 403);

    const [g] = await db.select().from(groups).where(eq(groups.id, id));
    if (!g) return c.json(fail("NOT_FOUND", "Group not found"), 404);
    return c.json(ok(g));
});

// Update group (admin only)
group.patch(
  "/:id",
  zValidator("json", updateGroupSchema),
  async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
    if (!membership || membership.role !== "admin") return c.json(fail("FORBIDDEN", "Admin only"), 403);

    const body = c.req.valid("json");
    const [updated] = await db
      .update(groups)
      .set(body)
      .where(eq(groups.id, id))
      .returning();
    if (!updated) return c.json(fail("NOT_FOUND", "Group not found"), 404);
    return c.json(ok(updated));
  }
);

// Delete group (admin only)
group.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
  if (!membership || membership.role !== "admin") return c.json(fail("FORBIDDEN", "Admin only"), 403);

  await db.delete(groups).where(eq(groups.id, id));
  return c.json(ok({ deleted: true }));
});

// ─── Company summary (departments with budgets, spend, claims) ──
group.get("/company-summary", async (c) => {
  const userId = c.get("userId");

  // Get all department groups the user belongs to
  const userGroups = await db
    .select({ group: groups })
    .from(groups)
    .innerJoin(memberships, eq(memberships.groupId, groups.id))
    .where(and(eq(groups.kind, "department"), eq(memberships.userId, userId)))
    .orderBy(desc(groups.createdAt));
  const departmentGroups = userGroups.map((r) => r.group);

  if (departmentGroups.length === 0) {
    return c.json(ok({ departments: [], totalBudget: 0, totalSpent: 0, pendingClaims: 0 }));
  }

  const groupIds = departmentGroups.map((g) => g.id);

  // Get budgets for these groups
  const budgetData = await db
    .select()
    .from(budgets)
    .where(inArray(budgets.groupId, groupIds));

  // Get expenses for these groups
  const expenseData = await db
    .select()
    .from(expenses)
    .where(inArray(expenses.groupId, groupIds));

  // Get claims for expenses in these groups
  const claimData = await db
    .select({
      id: claims.id,
      status: claims.status,
      expenseId: claims.expenseId,
      reviewerId: claims.reviewerId,
      createdAt: claims.createdAt,
      expenseUserId: expenses.userId,
    })
    .from(claims)
    .innerJoin(expenses, eq(claims.expenseId, expenses.id))
    .where(inArray(expenses.groupId, groupIds));

  // Get member counts
  const memberCounts = await db
    .select({
      groupId: memberships.groupId,
      count: sql<number>`count(*)::int`,
    })
    .from(memberships)
    .where(inArray(memberships.groupId, groupIds))
    .groupBy(memberships.groupId);

  const memberCountMap = new Map(memberCounts.map((m) => [m.groupId, m.count]));

  // Get user's role in each group (to determine if admin)
  const myMemberships = await db
    .select()
    .from(memberships)
    .where(and(
      inArray(memberships.groupId, groupIds),
      eq(memberships.userId, userId)
    ));
  const roleMap = new Map(myMemberships.map((m) => [m.groupId, m.role]));

  // Build department summaries
  const departments = departmentGroups.map((g) => {
    const deptBudgets = budgetData.filter((b) => b.groupId === g.id);
    const deptExpenses = expenseData.filter((e) => e.groupId === g.id);
    const deptClaims = claimData.filter((c) => deptExpenses.some((e) => e.id === c.expenseId));

    const totalBudget = deptBudgets.reduce((s, b) => s + Number(b.amount), 0);
    const totalSpent = deptExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const pendingClaims = deptClaims.filter((c) => c.status === "submitted").length;

    return {
      id: g.id,
      name: g.name,
      createdAt: g.createdAt,
      memberCount: memberCountMap.get(g.id) ?? 0,
      role: roleMap.get(g.id) ?? "member",
      totalBudget,
      totalSpent,
      budgetUtilization: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
      pendingClaims,
      expenseCount: deptExpenses.length,
    };
  });

  const totalBudget = departments.reduce((s, d) => s + d.totalBudget, 0);
  const totalSpent = departments.reduce((s, d) => s + d.totalSpent, 0);
  const pendingClaims = departments.reduce((s, d) => s + d.pendingClaims, 0);

  return c.json(ok({
    departments,
    totalBudget,
    totalSpent,
    pendingClaims,
  }));
});

// Compute group balances: net amount each user is owed/owes
group.get("/:id/balances", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.groupId, id), eq(memberships.userId, userId)));
  if (!membership) return c.json(fail("FORBIDDEN", "Not a member"), 403);

  // Sum of splits owed by each user in this group
  const groupExpenses = await db
    .select({ expenseId: expenses.id, userId: expenses.userId, amount: expenses.amount })
    .from(expenses)
    .where(eq(expenses.groupId, id));

  const groupSplits = await db
    .select({ expenseId: splits.expenseId, userId: splits.userId, amount: splits.amount })
    .from(splits)
    .innerJoin(expenses, eq(splits.expenseId, expenses.id))
    .where(eq(expenses.groupId, id));

  const groupSettlements = await db
    .select()
    .from(settlements)
    .where(eq(settlements.groupId, id));

  // Compute net balance per user
  const net: Record<string, number> = {};

  for (const exp of groupExpenses) {
    net[exp.userId] = (net[exp.userId] ?? 0) + Number(exp.amount);
  }
  for (const s of groupSplits) {
    net[s.userId] = (net[s.userId] ?? 0) - Number(s.amount);
  }
  for (const s of groupSettlements) {
    net[s.fromUserId] = (net[s.fromUserId] ?? 0) - Number(s.amount);
    net[s.toUserId] = (net[s.toUserId] ?? 0) + Number(s.amount);
  }

  // Simplify to pairwise debts
  const debts: { from: string; to: string; amount: number }[] = [];
  const entries = Object.entries(net).filter(([, v]) => Math.abs(v) > 0.01);
  const debtors = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  const creditors = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const [dId, dAmt] = debtors[i];
    const [cId, cAmt] = creditors[j];
    const transfer = Math.min(-dAmt, cAmt);
    if (transfer > 0.01) {
      debts.push({ from: dId, to: cId, amount: Math.round(transfer * 100) / 100 });
    }
    debtors[i] = [dId, dAmt + transfer];
    creditors[j] = [cId, cAmt - transfer];
    if (Math.abs(debtors[i][1]) < 0.01) i++;
    if (Math.abs(creditors[j][1]) < 0.01) j++;
  }

  return c.json(ok({ net, debts }));
});

export default group;
