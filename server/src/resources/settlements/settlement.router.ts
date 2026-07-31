import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SettlementController } from './settlement.controller';
import { createSettlementSchema, settlementQuerySchema } from './settlement.schema';
import type { AppEnv } from '../../lib/middleware';

const settlement = new Hono<AppEnv>();
const controller = new SettlementController();

settlement.post('/', zValidator('json', createSettlementSchema), (c) =>
    controller.create(c)
);

settlement.get('/', zValidator('query', settlementQuerySchema), (c) =>
    controller.list(c)
);

settlement.get('/:id', (c) => controller.getById(c));

export default settlement;
