import type { Context } from 'hono';
import { AdjustmentService } from './adjustment.service';
import type { CreateAdjustmentInput } from './adjustment.schema';
import { validBody } from '../../lib/middleware';
import { ok, fail } from '../../lib/response';
import type { AppEnv } from '../../lib/middleware';

const service = new AdjustmentService();

export class AdjustmentController {
    async request(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const body = validBody<CreateAdjustmentInput>(c);

        try {
            const adjustment = await service.request(userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(adjustment), 201);
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Request failed'
                ),
                400
            );
        }
    }

    async approve(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;

        try {
            const adj = await service.approve(id, userId, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(adj));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Approval failed'
                ),
                400
            );
        }
    }

    async reject(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;
        const body = (await c.req.json().catch(() => undefined)) as
            { reason?: string } | undefined;

        try {
            const adj = await service.reject(
                id,
                userId,
                body?.reason ?? undefined,
                {
                    actorId: userId,
                    actorNameSnapshot: session.user.name,
                    actorEmailSnapshot: session.user.email
                }
            );
            return c.json(ok(adj));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Rejection failed'
                ),
                400
            );
        }
    }

    async list(c: Context<AppEnv>) {
        const expenseId = c.req.param('expenseId')!;
        const adjustments = await service.list(expenseId);
        return c.json(ok(adjustments));
    }
}
