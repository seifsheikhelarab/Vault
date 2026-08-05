import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AdjustmentController } from './adjustment.controller';
import { createAdjustmentSchema } from './adjustment.schema';
import type { AppEnv } from '../../lib/middleware';

const adjustment = new Hono<AppEnv>();
const controller = new AdjustmentController();

adjustment.post('/', zValidator('json', createAdjustmentSchema), (c) =>
    controller.request(c)
);
adjustment.get('/expense/:expenseId', (c) => controller.list(c));
adjustment.post('/:id/approve', (c) => controller.approve(c));
adjustment.post('/:id/reject', (c) => controller.reject(c));

export default adjustment;
