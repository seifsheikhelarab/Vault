import { ExpenseService } from './expense.service';
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseQueryInput } from './expense.schema';
import { ok, fail } from '../../lib/response';
import { validBody, validQuery, type AppContext } from '../../lib/middleware';

const service = new ExpenseService();

export class ExpenseController {
    async create(c: AppContext) {
        const userId = c.get('userId');
        const body = validBody<CreateExpenseInput>(c);
        const expense = await service.create(userId, body);
        return c.json(ok(expense), 201);
    }

    async list(c: AppContext) {
        const userId = c.get('userId');
        const query = validQuery<ExpenseQueryInput>(c);

        if (query.groupId) {
            const { db } = await import('../../lib/db');
            const { memberships } = await import('../../lib/db/schema');
            const { eq, and } = await import('drizzle-orm');
            const [membership] = await db
                .select()
                .from(memberships)
                .where(
                    and(
                        eq(memberships.groupId, query.groupId),
                        eq(memberships.userId, userId)
                    )
                );
            if (!membership) {
                const { fail } = await import('../../lib/response');
                return c.json(
                    fail('FORBIDDEN', 'Not a member of this group'),
                    403
                );
            }
        }

        const result = await service.list(userId, query);
        return c.json(ok(result));
    }

    async getById(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const expense = await service.getById(userId, id);
        if (!expense)
            return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
        return c.json(ok(expense));
    }

    async update(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const body = validBody<UpdateExpenseInput>(c);
        const expense = await service.update(userId, id, body);
        if (!expense)
            return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
        return c.json(ok(expense));
    }

    async delete(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const expense = await service.delete(userId, id);
        if (!expense)
            return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
        return c.json(ok({ deleted: true }));
    }
}
