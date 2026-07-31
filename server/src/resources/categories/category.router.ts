import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { CategoryController } from './category.controller';
import { createCategorySchema } from './category.schema';
import type { AppEnv } from '../../lib/middleware';

const category = new Hono<AppEnv>();
const controller = new CategoryController();

category.post('/', zValidator('json', createCategorySchema), (c) =>
    controller.create(c)
);

category.get('/', (c) => controller.list(c));

export default category;
