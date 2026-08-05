import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SettlementController } from './settlement.controller';
import {
    createSettlementSchema,
    createSettlementCorrectionSchema
} from './settlement.schema';
import type { AppEnv } from '../../lib/middleware';

const settlement = new Hono<AppEnv>();
const controller = new SettlementController();

settlement.post('/', zValidator('json', createSettlementSchema), (c) =>
    controller.create(c)
);
settlement.get('/', (c) => controller.list(c));
settlement.get('/balances/:groupId', (c) => controller.balances(c));
settlement.post(
    '/correct',
    zValidator('json', createSettlementCorrectionSchema),
    (c) => controller.correct(c)
);
settlement.delete('/:id', (c) => controller.delete(c));

export default settlement;
