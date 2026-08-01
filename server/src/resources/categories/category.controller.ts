import { CategoryService } from './category.service';
import type { CreateCategoryInput, UpdateCategoryInput } from './category.schema';
import { ok, fail } from '../../lib/response';
import { validBody, type AppContext } from '../../lib/middleware';

const service = new CategoryService();

export class CategoryController {
    async create(c: AppContext) {
        const userId = c.get('userId');
        const body = validBody<CreateCategoryInput>(c);
        const category = await service.create(userId, body);
        return c.json(ok(category), 201);
    }

    async list(c: AppContext) {
        const userId = c.get('userId');
        const data = await service.list(userId);
        return c.json(ok(data));
    }

    async update(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const body = validBody<UpdateCategoryInput>(c);
        const result = await service.update(userId, id, body);
        if ('error' in result && result.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not your category'), 403);
        return c.json(ok(result));
    }

    async delete(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const result = await service.delete(userId, id);
        if ('error' in result && result.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not your category'), 403);
        if ('error' in result && result.error === 'IN_USE')
            return c.json(fail('CONFLICT', 'Category has expenses — reassign them first'), 409);
        return c.json(ok({ deleted: true }));
    }
}
