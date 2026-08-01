import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ExpenseController } from './expense.controller';
import {
    createExpenseSchema,
    updateExpenseSchema,
    expenseQuerySchema
} from './expense.schema';
import type { AppEnv } from '../../lib/middleware';

const expense = new Hono<AppEnv>();
const controller = new ExpenseController();

expense.post('/', zValidator('json', createExpenseSchema), (c) =>
    controller.create(c)
);

expense.get('/', zValidator('query', expenseQuerySchema), (c) =>
    controller.list(c)
);

expense.get('/:id', (c) => controller.getById(c));

expense.patch('/:id', zValidator('json', updateExpenseSchema), (c) =>
    controller.update(c)
);

expense.delete('/:id', (c) => controller.delete(c));

export default expense;
