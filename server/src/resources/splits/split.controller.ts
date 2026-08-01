import { SplitService } from './split.service';
import type { CreateSplitInput, SplitQueryInput } from './split.schema';
import { ok, fail } from '../../lib/response';
import { validBody, validQuery, type AppContext } from '../../lib/middleware';

const service = new SplitService();

export class SplitController {
    async create(c: AppContext) {
        const userId = c.get('userId');
        const body = validBody<CreateSplitInput>(c);
        const result = await service.create(userId, body);

        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Not your expense'), 403);
            if (result.error === 'BAD_REQUEST')
                return c.json(
                    fail('BAD_REQUEST', result.message ?? 'Invalid splits'),
                    400
                );
        }

        return c.json(ok(result), 201);
    }

    async list(c: AppContext) {
        const query = validQuery<SplitQueryInput>(c);
        const data = await service.list(query);
        return c.json(ok(data));
    }

    async delete(c: AppContext) {
        const userId = c.get('userId');
        const expenseId = c.req.query('expenseId');
        if (!expenseId)
            return c.json(fail('BAD_REQUEST', 'expenseId required'), 400);

        const result = await service.deleteByExpense(userId, expenseId);
        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Not your expense'), 403);
        }

        return c.json(ok({ deleted: true }));
    }
}
