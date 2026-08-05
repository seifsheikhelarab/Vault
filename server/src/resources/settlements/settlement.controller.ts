import type { Context } from 'hono';
import { SettlementService } from './settlement.service';
import type {
    CreateSettlementInput,
    CreateSettlementCorrectionInput
} from './settlement.schema';
import { validBody } from '../../lib/middleware';
import { ok, fail } from '../../lib/response';
import type { AppEnv } from '../../lib/middleware';

const service = new SettlementService();

export class SettlementController {
    async create(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const body = validBody<CreateSettlementInput>(c);

        try {
            const settlement = await service.create(userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(settlement), 201);
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error
                        ? err.message
                        : 'Failed to create settlement'
                ),
                400
            );
        }
    }

    async list(c: Context<AppEnv>) {
        const groupId = c.req.query('groupId') ?? undefined;
        const data = await service.list(groupId);
        return c.json(ok(data));
    }

    async balances(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const groupId = c.req.param('groupId')!;

        const isMember = await service.isGroupMember(groupId, userId);
        if (!isMember) {
            return c.json(
                fail('FORBIDDEN', 'Not a member of this group'),
                403
            );
        }

        const balances = await service.getBalances(groupId);
        return c.json(ok(balances));
    }

    async correct(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const body = validBody<CreateSettlementCorrectionInput>(c);

        try {
            const correction = await service.correct(userId, body, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(correction), 201);
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Correction failed'
                ),
                400
            );
        }
    }

    async delete(c: Context<AppEnv>) {
        const userId = c.get('userId');
        const session = c.get('session');
        const id = c.req.param('id')!;

        try {
            const result = await service.delete(id, userId, {
                actorId: userId,
                actorNameSnapshot: session.user.name,
                actorEmailSnapshot: session.user.email
            });
            return c.json(ok(result));
        } catch (err: unknown) {
            return c.json(
                fail(
                    'VALIDATION_ERROR',
                    err instanceof Error ? err.message : 'Delete failed'
                ),
                400
            );
        }
    }
}
