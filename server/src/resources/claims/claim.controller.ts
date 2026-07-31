import { ClaimService } from './claim.service';
import { ok, fail } from '../../lib/response';

const service = new ClaimService();

export class ClaimController {
    async create(c: any) {
        const userId = c.get('userId') as string;
        const body = c.req.valid('json');
        const result = await service.create(userId, body);

        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Expense not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Not your expense'), 403);
            if (result.error === 'CONFLICT')
                return c.json(fail('CONFLICT', 'Expense already has a claim'), 409);
        }

        return c.json(ok(result), 201);
    }

    async list(c: any) {
        const userId = c.get('userId') as string;
        const query = c.req.valid('query');
        const result = await service.list(userId, query);

        if ('error' in result && result.error === 'FORBIDDEN')
            return c.json(fail('FORBIDDEN', 'Not a member of this group'), 403);

        return c.json(ok(result));
    }

    async approve(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const claim = await service.approve(userId, id);
        if (!claim) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
        return c.json(ok(claim));
    }

    async reject(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const body = c.req.valid('json');
        const claim = await service.reject(userId, id, body);
        if (!claim) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
        return c.json(ok(claim));
    }

    async reimburse(c: any) {
        const userId = c.get('userId') as string;
        const id = c.req.param('id')!;
        const claim = await service.reimburse(userId, id);
        if (!claim) return c.json(fail('NOT_FOUND', 'Claim not found'), 404);
        return c.json(ok(claim));
    }
}
