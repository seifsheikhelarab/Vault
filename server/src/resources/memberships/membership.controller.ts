import { MembershipService } from './membership.service';
import type { AddMemberInput, UpdateMemberInput } from './membership.schema';
import { ok, fail } from '../../lib/response';
import { validBody, type AppContext } from '../../lib/middleware';

const service = new MembershipService();

export class MembershipController {
    async list(c: AppContext) {
        const userId = c.get('userId');
        const groupId = c.req.query('groupId');
        if (!groupId)
            return c.json(fail('BAD_REQUEST', 'groupId required'), 400);

        const result = await service.list(userId, groupId);
        if ('error' in result)
            return c.json(fail('FORBIDDEN', 'Not a member'), 403);

        return c.json(ok(result));
    }

    async add(c: AppContext) {
        const userId = c.get('userId');
        const groupId = c.req.query('groupId');
        if (!groupId)
            return c.json(fail('BAD_REQUEST', 'groupId required'), 400);

        const body = validBody<AddMemberInput>(c);
        const result = await service.add(userId, groupId, body);

        if ('error' in result) {
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Not a member'), 403);
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'User not found'), 404);
            if (result.error === 'CONFLICT')
                return c.json(fail('CONFLICT', 'Already a member'), 409);
        }

        return c.json(ok(result), 201);
    }

    async update(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const body = validBody<UpdateMemberInput>(c);
        const result = await service.update(userId, id, body);

        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Member not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Admin only'), 403);
        }

        return c.json(ok(result));
    }

    async remove(c: AppContext) {
        const userId = c.get('userId');
        const id = c.req.param('id')!;
        const result = await service.remove(userId, id);

        if ('error' in result) {
            if (result.error === 'NOT_FOUND')
                return c.json(fail('NOT_FOUND', 'Member not found'), 404);
            if (result.error === 'FORBIDDEN')
                return c.json(fail('FORBIDDEN', 'Admin only'), 403);
        }

        return c.json(ok({ deleted: true }));
    }
}
