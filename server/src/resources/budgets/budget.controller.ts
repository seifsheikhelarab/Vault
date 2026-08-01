import { BudgetService } from './budget.service';
import type { CreateBudgetInput, UpdateBudgetInput } from './budget.schema';
import { ok, fail } from '../../lib/response';
import { validBody, type AppContext } from '../../lib/middleware';

const service = new BudgetService();

export class BudgetController {
    async create(c: AppContext) {
        const userId = c.get('userId');
        const body = validBody<CreateBudgetInput>(c);
        const budget = await service.create(userId, body);
        return c.json(ok(budget), 201);
    }

    async list(c: AppContext) {
        const userId = c.get('userId');
        const data = await service.list(userId);
        return c.json(ok(data));
    }

    async update(c: AppContext) {
        const id = c.req.param('id')!;
        const body = validBody<UpdateBudgetInput>(c);
        const budget = await service.update(id, body);
        if (!budget) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
        return c.json(ok(budget));
    }

    async delete(c: AppContext) {
        const id = c.req.param('id')!;
        const budget = await service.delete(id);
        if (!budget) return c.json(fail('NOT_FOUND', 'Budget not found'), 404);
        return c.json(ok({ deleted: true }));
    }
}
