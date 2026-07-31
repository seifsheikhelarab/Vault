import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { BudgetController } from './budget.controller';
import { createBudgetSchema, updateBudgetSchema } from './budget.schema';
import type { AppEnv } from '../../lib/middleware';

const budget = new Hono<AppEnv>();
const controller = new BudgetController();

budget.post('/', zValidator('json', createBudgetSchema), (c) =>
    controller.create(c)
);

budget.get('/', (c) => controller.list(c));

budget.patch('/:id', zValidator('json', updateBudgetSchema), (c) =>
    controller.update(c)
);

budget.delete('/:id', (c) => controller.delete(c));

export default budget;
