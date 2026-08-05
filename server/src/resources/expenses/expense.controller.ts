import type { Context } from 'hono';
import { ExpenseService } from './expense.service';
import type {
    CreateExpenseInput,
    ReviseExpenseInput,
    DeleteExpenseInput
} from './expense.schema';
import { validBody } from '../../lib/middleware';
import { ok, fail } from '../../lib/response';
import type { AppEnv } from '../../lib/middleware';

const service = new ExpenseService();

export class ExpenseController {
    async create(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const body = validBody<CreateExpenseInput>(c);

        try {
            const expense = await service.create(userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(expense), 201);
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error
                        ? err.message
                        : 'Failed to create expense'
                ),
                400
            );
        }
    }

    async list(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const groupId = c.req.query('groupId') ?? undefined;
        const scope = c.req.query('scope') ?? undefined;
        const categoryId = c.req.query('categoryId') ?? undefined;
        const page = parseInt(c.req.query('page') ?? '1');
        const pageSize = parseInt(c.req.query('pageSize') ?? '50');

        const data = await service.list({
            userId,
            groupId,
            scope,
            categoryId,
            page,
            pageSize
        });
        return c.json(ok(data));
    }

    async get(c: Context<AppEnv>) {
        const id = c.req.param('id')!;
        const expense = await service.get(id);
        if (!expense)
            return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
        return c.json(ok(expense));
    }

    async getWithSplits(c: Context<AppEnv>) {
        const id = c.req.param('id')!;
        const result = await service.getWithSplits(id);
        if (!result) return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
        return c.json(ok(result));
    }

    async revise(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;
        const body = validBody<ReviseExpenseInput>(c);

        try {
            const expense = await service.revise(id, userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(expense));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Revision failed'
                ),
                400
            );
        }
    }

    async delete(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;
        const body = validBody<DeleteExpenseInput>(c);

        try {
            const result = await service.delete(id, userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(result));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Delete failed'
                ),
                400
            );
        }
    }

    async revisions(c: Context<AppEnv>) {
        const id = c.req.param('id')!;
        const revisions = await service.getRevisions(id);
        return c.json(ok(revisions));
    }
}
