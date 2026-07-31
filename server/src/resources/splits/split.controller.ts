import { SplitService } from './split.service';
import { ok, fail } from '../../lib/response';

const service = new SplitService();

export class SplitController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        const result = await service.create(userId, body);

        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Not your expense'), 403);
            if (result.error === 'BAD_REQUEST')
                return c.json(fail('BAD_REQUEST', result.message ?? 'Invalid splits'), 400);
        }

        return c.json(ok(result), 201);
    }

    async list(c: any) {
        const query = c.req.valid('query');
        const data = await service.list(query);
        return c.json(ok(data));
    }

    async delete(c: any) {
        const userId = c.get('userId') as string;
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
