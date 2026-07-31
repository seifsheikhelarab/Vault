import { GroupService } from './group.service';
import { ok, fail } from '../../lib/response';

const service = new GroupService();

export class GroupController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        const group = await service.create(userId, body);
        return c.json(ok(group), 201);
    }

    async list(c: any) {
        const userId = c.get('userId') as string;
        const data = await service.list(userId);
        return c.json(ok(data));
    }

    async getById(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const group = await service.getById(userId, id);
        if ('error' in group && group.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not a member'), 403);
        if (!group) return c.json(fail('NOT_FOUND', 'Group not found'), 404);
        return c.json(ok(group));
    }

    async update(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const body = c.req.valid('json');
        const group = await service.update(userId, id, body);
        if ('error' in group && group.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not a member'), 403);
        if ('error' in group && group.error === 'NOT_ADMIN')
            return c.json(fail('FORBIDDEN', 'Admin only'), 403);
        return c.json(ok(group));
    }

    async delete(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const result = await service.delete(userId, id);
        if ('error' in result && result.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not a member'), 403);
        if ('error' in result && result.error === 'NOT_ADMIN')
            return c.json(fail('FORBIDDEN', 'Admin only'), 403);
        return c.json(ok({ deleted: true }));
    }

    async getBalances(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const balances = await service.getBalances(userId, id);
        if (!balances) return c.json(fail('FORBIDDEN', 'Not a member'), 403);
        return c.json(ok(balances));
    }

    async getCompanySummary(c: any) {
        const userId = c.get('userId') as string;
        const summary = await service.getCompanySummary(userId);
        return c.json(ok(summary));
    }
}
