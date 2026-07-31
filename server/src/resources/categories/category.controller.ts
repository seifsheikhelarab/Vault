import { CategoryService } from './category.service';
import { ok } from '../../lib/response';

const service = new CategoryService();

export class CategoryController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        const category = await service.create(userId, body);
        return c.json(ok(category), 201);
    }

    async list(c: any) {
        const userId = c.get('userId') as string;
        const data = await service.list(userId);
        return c.json(ok(data));
    }
}
