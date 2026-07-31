import { SettlementService } from './settlement.service';
import { ok, fail } from '../../lib/response';

const service = new SettlementService();

export class SettlementController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        if (body.toUserId === userId)
            return c.json(fail('BAD_REQUEST', 'Cannot settle with yourself'), 400);
        const settlement = await service.create(userId, body);
        return c.json(ok(settlement), 201);
    }

    async list(c: any) {
        const userId = c.get('userId') as string;
        const query = c.req.valid('query');
        const data = await service.list(userId, query);
        return c.json(ok(data));
    }

    async getById(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const settlement = await service.getById(userId, id);
        if (!settlement)
            return c.json(fail('NOT_FOUND', 'Settlement not found'), 404);
        return c.json(ok(settlement));
    }
}
