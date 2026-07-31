import { BudgetService } from './budget.service';
import { ok, fail } from '../../lib/response';

const service = new BudgetService();

export class BudgetController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        const budget = await service.create(userId, body);
        return c.json(ok(budget), 201);
    }

    async list(c: any) {
        const userId = c.get('userId') as string;
        const data = await service.list(userId);
        return c.json(ok(data));
    }

    async update(c: any) {
        const id = c.req.param('id')!;
        const body = c.req.valid('json');
        const budget = await service.update(id, body);
        if (!budget) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
        return c.json(ok(budget));
    }

    async delete(c: any) {
        const id = c.req.param('id')!;
        const budget = await service.delete(id);
        if (!budget) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
        return c.json(ok({ deleted: true }));
    }
}
