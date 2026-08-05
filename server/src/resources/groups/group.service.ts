import { desc, eq, inArray, and } from 'drizzle-orm';
import { db } from '../../lib/db';
import {
    groups,
    memberships,
    expenses,
    budgets,
    claims
} from '../../lib/db/schema';
import {
    recordAuditEvent,
    AuditAction,
    type AuditContext
} from '../../lib/audit';

export class GroupService {
    async create(
        createdBy: string,
        data: { name: string; kind?: 'social' | 'department' },
        auditCtx: AuditContext
    ) {
        const id = crypto.randomUUID();
        const kind = data.kind ?? 'social';

        await db.transaction(async (tx) => {
            await tx
                .insert(groups)
                .values({ id, name: data.name, kind, createdBy });

            // Creator is automatically an admin member
            await tx.insert(memberships).values({
                id: crypto.randomUUID(),
                groupId: id,
                userId: createdBy,
                role: 'admin'
            });

            await recordAuditEvent(
                auditCtx,
                AuditAction.GROUP_CREATED,
                {
                    groupId: id,
                    targetType: 'group',
                    targetId: id,
                    reason: data.name
                },
                tx
            );
        });

        const [created] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, id));
        return created;
    }

    async list(userId: string) {
        const memberGroups = await db
            .select({ groupId: memberships.groupId })
            .from(memberships)
            .where(eq(memberships.userId, userId));

        if (memberGroups.length === 0) return [];

        const groupIds = memberGroups.map((m) => m.groupId);
        return db
            .select()
            .from(groups)
            .where(inArray(groups.id, groupIds))
            .orderBy(desc(groups.createdAt));
    }

    async get(id: string) {
        const [group] = await db
            .select()
            .from(groups)
            .where(eq(groups.id, id))
            .limit(1);
        return group ?? null;
    }

    async close(groupId: string, actorId: string, auditCtx: AuditContext) {
        const group = await this.get(groupId);
        if (!group) throw new Error('Group not found');
        if (group.createdBy !== actorId)
            throw new Error('Only the owner can close a group');
        if (group.closed) throw new Error('Group is already closed');

        await db.transaction(async (tx) => {
            await tx
                .update(groups)
                .set({ closed: true, closedAt: new Date() })
                .where(eq(groups.id, groupId));

            await recordAuditEvent(
                auditCtx,
                AuditAction.GROUP_CLOSED,
                {
                    groupId,
                    targetType: 'group',
                    targetId: groupId
                },
                tx
            );
        });

        return this.get(groupId);
    }

    async getSummary(userId: string) {
        const memberGroups = await db
            .select({ groupId: memberships.groupId, role: memberships.role })
            .from(memberships)
            .where(eq(memberships.userId, userId));

        if (memberGroups.length === 0)
            return {
                departments: [],
                totalBudget: 0,
                totalSpent: 0,
                pendingClaims: 0
            };

        const groupIds = memberGroups.map((m) => m.groupId);
        const departments = await db
            .select()
            .from(groups)
            .where(
                and(inArray(groups.id, groupIds), eq(groups.kind, 'department'))
            );

        const budgetData = await db
            .select()
            .from(budgets)
            .where(inArray(budgets.groupId, groupIds));

        const expenseData = await db
            .select({
                groupId: expenses.groupId,
                amountCents: expenses.amountCents
            })
            .from(expenses)
            .where(inArray(expenses.groupId, groupIds));        const claimData = await db
            .select({ groupId: expenses.groupId })
            .from(claims)
            .innerJoin(expenses, eq(claims.expenseId, expenses.id))
            .where(
                and(
                    inArray(expenses.groupId, groupIds),
                    eq(claims.status, 'submitted')
                )
            );
        const pendingByDept = claimData.reduce<Record<string, number>>(
            (map, c) => {
                if (c.groupId) map[c.groupId] = (map[c.groupId] ?? 0) + 1;
                return map;
            },
            {}
        );

        const memberData = await db
            .select({ groupId: memberships.groupId })
            .from(memberships)
            .where(inArray(memberships.groupId, groupIds));
        const membersByDept = memberData.reduce<Record<string, number>>(
            (map, m) => {
                map[m.groupId] = (map[m.groupId] ?? 0) + 1;
                return map;
            },
            {}
        );

        const deptList = departments.map((d) => {
            const deptBudgets = budgetData.filter((b) => b.groupId === d.id);
            const deptExpenses = expenseData.filter((e) => e.groupId === d.id);
            const totalSpent = deptExpenses.reduce((s, e) => s + e.amountCents, 0);
            const totalBudget = deptBudgets.reduce(
                (s, b) => s + Number(b.amountCents),
                0
            );

            return {
                id: d.id,
                name: d.name,
                memberCount: membersByDept[d.id] ?? 0,
                expenseCount: deptExpenses.length,
                role: memberGroups.find((m) => m.groupId === d.id)?.role ?? 'member',
                totalBudget,
                totalSpent,
                budgetUtilization:
                    totalBudget > 0
                        ? Math.round((totalSpent / totalBudget) * 100)
                        : 0,
                pendingClaims: pendingByDept[d.id] ?? 0
            };
        });

        const totalBudget = deptList.reduce((s, d) => s + d.totalBudget, 0);
        const totalSpent = deptList.reduce((s, d) => s + d.totalSpent, 0);
        const pendingClaims = deptList.reduce((s, d) => s + d.pendingClaims, 0);

        return {
            departments: deptList,
            totalBudget,
            totalSpent,
            pendingClaims
        };
    }
}
