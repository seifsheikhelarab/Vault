import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CategoryController } from './category.controller';
import { createCategorySchema, updateCategorySchema } from './category.schema';
import type { AppEnv } from '../../lib/middleware';

const category = new Hono<AppEnv>();
const controller = new CategoryController();

category.post('/', zValidator('json', createCategorySchema), (c) =>
    controller.create(c)
);

category.get('/', (c) => controller.list(c));

category.patch('/:id', zValidator('json', updateCategorySchema), (c) =>
    controller.update(c)
);

category.delete('/:id', (c) => controller.delete(c));

export default category;
