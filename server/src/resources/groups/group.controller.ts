import { GroupService } from './group.service';
import { validBody } from '../../lib/middleware';
import { ok, fail } from '../../lib/response';
import type { AppEnv } from '../../lib/middleware';
import type { Context } from 'hono';

const service = new GroupService();

export class GroupController {
    async create(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const body = validBody<{
            name: string;
            kind?: 'social' | 'department';
        }>(c);

        const group = await service.create(userId, body, {
            actorId: userId,
            actorNameSnapshot: session.user.name,
            actorEmailSnapshot: session.user.email
        });
        return c.json(ok(group), 201);
    }

    async list(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const data = await service.list(userId);
        return c.json(ok(data));
    }

    async get(c: Context<AppEnv>) {
        const id = c.req.param('id')!;
        const group = await service.get(id);
        if (!group) return c.json(fail('NOT_FOUND', 'Group not found'), 404);
        return c.json(ok(group));
    }

    async close(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;

        try {
            const group = await service.close(id, userId, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(group));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Closure failed'
                ),
                400
            );
        }
    }

    async summary(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const data = await service.getSummary(userId);
        return c.json(ok(data));
    }
}
