import { SettlementService } from './settlement.service';
import type { CreateSettlementInput, SettlementQueryInput } from './settlement.schema';
import { ok, fail } from '../../lib/response';
import { validBody, validQuery, type AppContext } from '../../lib/middleware';

const service = new SettlementService();

export class SettlementController {
    async create(c: AppContext) {
        const userId = c.get('userId');
        const body = validBody<CreateSettlementInput>(c);
        if (body.toUserId === userId)
            return c.json(
                fail('BAD_REQUEST', 'Cannot settle with yourself'),
                400
            );
        const settlement = await service.create(userId, body);
        return c.json(ok(settlement), 201);
    }

    async list(c: AppContext) {
        const userId = c.get('userId');
        const query = validQuery<SettlementQueryInput>(c);
        const data = await service.list(userId, query);
        return c.json(ok(data));
    }

    async getById(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const settlement = await service.getById(userId, id);
        if (!settlement)
            return c.json(fail('NOT_FOUND', 'Settlement not found'), 404);
        return c.json(ok(settlement));
    }
}
