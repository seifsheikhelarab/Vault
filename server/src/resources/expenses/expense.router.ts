import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExpenseController } from './expense.controller';
import {
    createExpenseSchema,
    reviseExpenseSchema,
    deleteExpenseSchema
} from './expense.schema';
import type { AppEnv } from '../../lib/middleware';

const expense = new Hono<AppEnv>();
const controller = new ExpenseController();

expense.post('/', zValidator('json', createExpenseSchema), (c) =>
    controller.create(c)
);
expense.get('/', (c) => controller.list(c));
expense.get('/:id', (c) => controller.get(c));
expense.get('/:id/splits', (c) => controller.getWithSplits(c));
expense.get('/:id/revisions', (c) => controller.revisions(c));
expense.patch('/:id', zValidator('json', reviseExpenseSchema), (c) =>
    controller.revise(c)
);
expense.delete('/:id', zValidator('json', deleteExpenseSchema), (c) =>
    controller.delete(c)
);

export default expense;
