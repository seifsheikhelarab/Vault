import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ClaimController } from './claim.controller';
import {
    createClaimSchema,
    claimQuerySchema,
    rejectClaimSchema
} from './claim.schema';
import type { AppEnv } from '../../lib/middleware';

const claim = new Hono<AppEnv>();
const controller = new ClaimController();

claim.post('/', zValidator('json', createClaimSchema), (c) =>
    controller.create(c)
);

claim.get('/', zValidator('query', claimQuerySchema), (c) =>
    controller.list(c)
);

claim.patch('/:id/approve', (c) => controller.approve(c));

claim.patch('/:id/reject', zValidator('json', rejectClaimSchema), (c) =>
    controller.reject(c)
);

claim.patch('/:id/reimburse', (c) => controller.reimburse(c));

export default claim;
